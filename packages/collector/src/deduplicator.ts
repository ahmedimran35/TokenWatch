import { Database } from './database'

export interface EventKey {
  provider: string
  sessionId: string
  timestamp: string
  inputTokens: number
  outputTokens: number
  rawMessageId?: string
  bubbleId?: string
  conversationId?: string
  messageId?: string
  responseId?: string
  cumulativeOutputTokens?: number
}

const MAX_MESSAGE_IDS = 100_000
const MAX_SESSION_IDS = 10_000
const MAX_CONVERSATION_TIMESTAMPS = 50_000
const MAX_BUBBLE_IDS = 50_000
const MAX_RESPONSE_IDS = 50_000
const MAX_CUMULATIVE_TOKENS = 10_000
const EVICTION_RATIO = 0.7

export class Deduplicator {
  private messageIdCache = new Set<string>()
  private cumulativeTokens = new Map<string, number>()
  private bubbleIdCache = new Set<string>()
  private conversationTimestampCache = new Map<string, Set<string>>()
  private sessionIdCache = new Map<string, Set<string>>()
  private responseIdCache = new Set<string>()

  constructor(private db: Database) {}

  private evictOldest<T extends Set<string>>(cache: T, maxSize: number): void {
    const targetSize = Math.floor(maxSize * EVICTION_RATIO)
    const excess = cache.size - targetSize
    if (excess > 0) {
      const it = cache.values()
      for (let i = 0; i < excess; i++) {
        const result = it.next()
        if (result.done) break
        cache.delete(result.value)
      }
    }
  }

  private evictOldestMap<T extends Map<string, any>>(cache: T, maxSize: number): void {
    const targetSize = Math.floor(maxSize * EVICTION_RATIO)
    const excess = cache.size - targetSize
    if (excess > 0) {
      const it = cache.keys()
      for (let i = 0; i < excess; i++) {
        const result = it.next()
        if (result.done) break
        cache.delete(result.value)
      }
    }
  }

  private loadCaches(): void {
    const sqliteDb = (this.db as any).getDatabase?.()
    if (!sqliteDb) return

    try {
      const rows = sqliteDb.prepare(
        'SELECT provider, session_id, raw_message_id, timestamp FROM token_events ORDER BY timestamp DESC LIMIT 50000'
      ).all() as Array<{ provider: string; session_id: string; raw_message_id: string | null; timestamp: string }>

      for (const row of rows) {
        if (row.raw_message_id) {
          if (this.messageIdCache.size >= MAX_MESSAGE_IDS) {
            this.evictOldest(this.messageIdCache, MAX_MESSAGE_IDS)
          }
          this.messageIdCache.add(row.raw_message_id)
        }
        if (row.provider === 'codex' && row.session_id) {
          const last = sqliteDb.prepare(
            'SELECT output_tokens FROM token_events WHERE provider = ? AND session_id = ? ORDER BY timestamp DESC LIMIT 1'
          ).get(row.provider, row.session_id) as any
          if (last) {
            if (this.cumulativeTokens.size >= MAX_CUMULATIVE_TOKENS) {
              this.evictOldestMap(this.cumulativeTokens, MAX_CUMULATIVE_TOKENS)
            }
            this.cumulativeTokens.set(row.session_id, last.output_tokens)
          }
        }
        if (row.provider === 'gemini' && row.session_id) {
          const conv = this.conversationTimestampCache.get(row.session_id) || new Set()
          conv.add(row.timestamp)
          this.conversationTimestampCache.set(row.session_id, conv)
        }
        if (row.provider === 'opencode' && row.raw_message_id) {
          if (this.responseIdCache.size >= MAX_RESPONSE_IDS) {
            this.evictOldest(this.responseIdCache, MAX_RESPONSE_IDS)
          }
          this.responseIdCache.add(row.raw_message_id)
        }
        if (row.session_id) {
          if (this.sessionIdCache.size >= MAX_SESSION_IDS) {
            this.evictOldestMap(this.sessionIdCache, MAX_SESSION_IDS)
          }
          const sids = this.sessionIdCache.get(row.provider) || new Set()
          sids.add(row.session_id)
          this.sessionIdCache.set(row.provider, sids)
        }
      }
    } catch {
      // SQLite table may not exist yet during initialization
    }
  }

  isDuplicate(event: EventKey): boolean {
    if (this.messageIdCache.size === 0) {
      this.loadCaches()
    }

    switch (event.provider) {
      case 'claude':
      case 'claude-desktop':
        return !!event.rawMessageId && this.messageIdCache.has(event.rawMessageId)

      case 'codex':
        return this.isCodexDuplicate(event)

      case 'cursor':
      case 'cursor-agent':
        return !!event.bubbleId && this.bubbleIdCache.has(event.bubbleId)

      case 'gemini':
        return this.isGeminiDuplicate(event)

      case 'opencode':
        return !!event.responseId && this.responseIdCache.has(event.responseId)

      case 'github-copilot':
      case 'roo-code':
      case 'kilo-code':
        return this.isConversationDuplicate(event)

      default:
        return !!event.rawMessageId && this.messageIdCache.has(event.rawMessageId)
    }
  }

  private isCodexDuplicate(event: EventKey): boolean {
    const prev = this.cumulativeTokens.get(event.sessionId)
    if (prev === undefined) return false
    const currentTotal = (event as any).cumulativeOutputTokens ?? (event.inputTokens + event.outputTokens)
    return currentTotal <= prev
  }

  private isGeminiDuplicate(event: EventKey): boolean {
    const conv = this.conversationTimestampCache.get(event.conversationId || '')
    if (!conv) return false
    return conv.has(event.timestamp)
  }

  private isConversationDuplicate(event: EventKey): boolean {
    const sids = this.sessionIdCache.get(event.provider)
    return !!sids && sids.has(event.sessionId)
  }

  record(event: EventKey): void {
    if (event.rawMessageId) {
      if (this.messageIdCache.size >= MAX_MESSAGE_IDS) {
        this.evictOldest(this.messageIdCache, MAX_MESSAGE_IDS)
      }
      this.messageIdCache.add(event.rawMessageId)
    }
    if (event.provider === 'codex' && event.sessionId) {
      if (this.cumulativeTokens.size >= MAX_CUMULATIVE_TOKENS) {
        this.evictOldestMap(this.cumulativeTokens, MAX_CUMULATIVE_TOKENS)
      }
      this.cumulativeTokens.set(event.sessionId, event.inputTokens + event.outputTokens)
    }
    if (event.bubbleId) {
      if (this.bubbleIdCache.size >= MAX_BUBBLE_IDS) {
        this.evictOldest(this.bubbleIdCache, MAX_BUBBLE_IDS)
      }
      this.bubbleIdCache.add(event.bubbleId)
    }
    if (event.conversationId) {
      if (this.conversationTimestampCache.size >= MAX_CONVERSATION_TIMESTAMPS) {
        this.evictOldestMap(this.conversationTimestampCache, MAX_CONVERSATION_TIMESTAMPS)
      }
      const conv = this.conversationTimestampCache.get(event.conversationId) || new Set()
      conv.add(event.timestamp)
      this.conversationTimestampCache.set(event.conversationId, conv)
    }
    if (event.responseId) {
      if (this.responseIdCache.size >= MAX_RESPONSE_IDS) {
        this.evictOldest(this.responseIdCache, MAX_RESPONSE_IDS)
      }
      this.responseIdCache.add(event.responseId)
    }
    if (event.sessionId) {
      if (this.sessionIdCache.size >= MAX_SESSION_IDS) {
        this.evictOldestMap(this.sessionIdCache, MAX_SESSION_IDS)
      }
      const sids = this.sessionIdCache.get(event.provider) || new Set()
      sids.add(event.sessionId)
      this.sessionIdCache.set(event.provider, sids)
    }
  }
}
