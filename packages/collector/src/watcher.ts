 import * as chokidar from 'chokidar'
 import * as path from 'path'
 import * as os from 'os'
 import * as fs from 'fs'
 import { parseLine } from './parser'
 import { Database } from './database'
 import { Deduplicator } from './deduplicator'
 import { logger } from './logger'
 import type { TokenEvent } from '@tokenwatch/types'

const MAX_FILE_SIZE = parseInt(process.env.TOKENWATCH_MAX_FILE_SIZE || '10485760', 10) // 10MB default

export interface ProviderConfig {
  name: string
  watchDir: string
  filePattern: string
  parse: (line: string, filePath: string) => TokenEvent | null
  dedupKey: (event: TokenEvent) => string
}

export class CollectorWatcher {
  private watchers: chokidar.FSWatcher[] = []
  private db: Database
  private deduplicator: Deduplicator
  private onEvent?: (event: TokenEvent) => void
  private providers: ProviderConfig[] = []

  constructor(options: { db: Database; onEvent?: (event: TokenEvent) => void }) {
    this.db = options.db
    this.deduplicator = new Deduplicator(options.db)
    this.onEvent = options.onEvent
  }

  addProvider(config: ProviderConfig): void {
    this.providers.push(config)
  }

   async start(): Promise<void> {
     this.autoDiscoverProviders()

     if (this.providers.length === 0) return

     // Start watchers for each provider
     for (const provider of this.providers) {
       try {
         const watcher = chokidar.watch(provider.filePattern, {
           cwd: provider.watchDir,
           persistent: true,
           ignoreInitial: true,
           awaitWriteFinish: { stabilityThreshold: 200 },
           followSymlinks: false,
         })

         watcher.on('add', (relativePath) => {
           const fullPath = path.join(provider.watchDir, relativePath)
           this.processFile(provider, fullPath)
         })

         watcher.on('change', (relativePath) => {
           const fullPath = path.join(provider.watchDir, relativePath)
           this.processFile(provider, fullPath)
         })

          watcher.on('error', (error) => {
            logger.error({ provider: provider.name, error }, 'Watcher error')
          })

          this.watchers.push(watcher)

          // Process existing files (respect watcher_state for crash recovery)
          const files = this.findExistingFiles(provider)
          logger.info({ provider: provider.name, count: files.length }, 'Found existing files')
          for (const file of files) {
            logger.debug({ provider: provider.name, file }, 'Processing existing file')
            try {
              this.processFile(provider, file)
            } catch (err) {
              logger.error({ provider: provider.name, file, err }, 'Failed to process file on startup, skipping')
            }
          }
       } catch (err) {
         logger.error({ provider: provider.name, err }, 'Failed to start watcher for provider')
       }
     }
   }

  private autoDiscoverProviders(): void {
    // Claude Code (default)
    const claudeDir = path.join(os.homedir(), '.claude', 'projects')
    if (fs.existsSync(claudeDir)) {
      this.addProvider({
        name: 'claude',
        watchDir: claudeDir,
        filePattern: '**/*.jsonl',
        parse: parseLine,
        dedupKey: (e) => e.id,
      })
    }

    // Claude Desktop
    const claudeDesktopDir = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions')
    if (fs.existsSync(claudeDesktopDir)) {
      this.addProvider({
        name: 'claude-desktop',
        watchDir: claudeDesktopDir,
        filePattern: '**/*.jsonl',
        parse: parseLine,
        dedupKey: (e) => e.id,
      })
    }

    // Codex
    const codexDir = process.env.CODEX_HOME || path.join(os.homedir(), '.codex', 'sessions')
    if (fs.existsSync(codexDir)) {
      this.addProvider({
        name: 'codex',
        watchDir: codexDir,
        filePattern: '**/*.jsonl',
        parse: (line, filePath) => {
          try {
            const entry = JSON.parse(line)
            if (entry.type === 'event' && entry.event?.type === 'token_count') {
              const event = entry.event
              return {
                id: `${filePath}:${event.conversation_id}:${event.turn_id}:${event.index}`,
                sessionId: event.conversation_id,
                projectPath: path.dirname(filePath),
                projectName: path.basename(path.dirname(filePath)),
                provider: 'codex',
                timestamp: new Date(event.timestamp || Date.now()),
                model: entry.model || 'gpt-4o',
                inputTokens: event.input_tokens || 0,
                outputTokens: event.output_tokens || 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: (event.input_tokens || 0) + (event.output_tokens || 0),
                costUsd: 0,
                toolName: '',
                toolInput: '',
                durationMs: 0,
                cumulativeOutputTokens: event.cumulative_output_tokens,
              } as TokenEvent
            }
            return null
          } catch {
            return null
          }
        },
        dedupKey: (e) => e.id,
      })
    }

    // Gemini CLI
    const geminiDir = path.join(os.homedir(), '.gemini', 'tmp')
    if (fs.existsSync(geminiDir)) {
      this.addProvider({
        name: 'gemini',
        watchDir: geminiDir,
        filePattern: '**/session-*.json',
        parse: (content, filePath) => {
          try {
            const session = JSON.parse(content)
            const events: TokenEvent[] = []
            for (const msg of session.messages || []) {
              if (msg.role !== 'model') continue
              const usage = msg.usageMetadata || {}
              const event: TokenEvent = {
                id: `${filePath}:${msg.id || msg.timestamp}`,
                sessionId: session.id || filePath,
                projectPath: path.dirname(filePath),
                projectName: path.basename(path.dirname(path.dirname(filePath))),
                provider: 'gemini',
                timestamp: new Date(msg.createTime || Date.now()),
                model: msg.model || 'gemini-2.5-pro',
                inputTokens: usage.promptTokenCount || 0,
                outputTokens: usage.candidatesTokenCount || 0,
                cacheReadTokens: usage.cachedContentTokenCount || 0,
                cacheWriteTokens: 0,
                totalTokens: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) + (usage.cachedContentTokenCount || 0),
                costUsd: 0,
                toolName: '',
                toolInput: '',
                durationMs: 0,
              }
              events.push(event)
            }
            return events.length > 0 ? events[0] : null
          } catch {
            return null
          }
        },
        dedupKey: (e) => e.id,
      })
    }

    // OpenClaw
    const openclawDir = path.join(os.homedir(), '.openclaw', 'agents')
    if (fs.existsSync(openclawDir)) {
      this.addProvider({
        name: 'openclaw',
        watchDir: openclawDir,
        filePattern: '**/*.jsonl',
        parse: (line, filePath) => {
          try {
            const entry = JSON.parse(line)
            if (entry.role !== 'assistant' || !entry.usage) return null
            const usage = entry.usage
            return {
              id: `${filePath}:${entry.responseId || entry.timestamp}`,
              sessionId: entry.sessionId || path.basename(filePath),
              projectPath: path.dirname(filePath),
              projectName: path.basename(path.dirname(filePath)),
              provider: 'openclaw',
              timestamp: new Date(entry.timestamp || Date.now()),
              model: entry.modelId || entry.model || 'openclaw-auto',
              inputTokens: usage.promptTokens || 0,
              outputTokens: usage.completionTokens || 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: (usage.promptTokens || 0) + (usage.completionTokens || 0),
              costUsd: 0,
              toolName: '',
              toolInput: '',
              durationMs: 0,
            } as TokenEvent
          } catch {
            return null
          }
        },
        dedupKey: (e) => e.id,
      })
    }
  }

  private findExistingFiles(provider: ProviderConfig): string[] {
    const files: string[] = []
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isSymbolicLink()) continue
          if (entry.isDirectory()) {
            walk(fullPath)
          } else if (entry.isFile() && (entry.name.endsWith('.jsonl') || entry.name.endsWith('.json'))) {
            files.push(fullPath)
          }
        }
      } catch {
        // ignore permission errors
      }
    }
    walk(provider.watchDir)
    return files
  }

  processFile(provider: ProviderConfig, filePath: string): void {
     try {
       const state = this.db.getWatcherState(filePath)
       const startPosition = state?.lastPosition ?? 0

       const stats = fs.statSync(filePath)
       if (stats.size > MAX_FILE_SIZE) {
         logger.warn({ filePath, size: stats.size, maxSize: MAX_FILE_SIZE }, 'Skipping file: size exceeds limit')
         return
       }
       if (stats.size < startPosition) {
         this.processFromPosition(provider, filePath, 0, stats.size)
         return
       }

       this.processFromPosition(provider, filePath, startPosition, stats.size)
     } catch (error) {
       logger.error({ filePath, error }, 'Error processing file, skipping')
     }
  }

  private processFromPosition(provider: ProviderConfig, filePath: string, start: number, end: number): void {
    const fd = fs.openSync(filePath, 'r')
    const bufferSize = end - start
    if (bufferSize <= 0) {
      fs.closeSync(fd)
      return
    }

    const buffer = Buffer.alloc(bufferSize)
    fs.readSync(fd, buffer, 0, bufferSize, start)
    fs.closeSync(fd)

    const content = buffer.toString('utf-8')

    if (filePath.endsWith('.json')) {
      // JSON file - parse as whole
      try {
        const event = provider.parse(content, filePath)
        if (event) {
          const eventTime = event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp)
          if (isNaN(eventTime.getTime())) return

          if (!this.deduplicator.isDuplicate({
            provider: provider.name,
            sessionId: event.sessionId,
            timestamp: eventTime.toISOString(),
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
          })) {
            const inserted = this.db.insertEvent(event)
            if (inserted) {
              this.updateSession(event)
            }
            this.deduplicator.record({
              provider: provider.name,
              sessionId: event.sessionId,
              timestamp: eventTime.toISOString(),
              inputTokens: event.inputTokens,
              outputTokens: event.outputTokens,
              cumulativeOutputTokens: (event as any).cumulativeOutputTokens,
              rawMessageId: (event as any).rawMessageId,
              bubbleId: (event as any).bubbleId,
              conversationId: (event as any).conversationId,
              responseId: (event as any).responseId,
            })
            if (this.onEvent) this.onEvent(event)
          }
        }
      } catch (err) {
        logger.error({ provider: provider.name, filePath, err }, 'Error parsing JSON file, skipping')
      }
    } else {
      // JSONL file - parse line by line
      const lines = content.split('\n').filter((line) => line.trim().length > 0)

      for (const line of lines) {
        try {
          const event = provider.parse(line, filePath)
          if (!event) continue

          const eventTime = event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp)
          if (isNaN(eventTime.getTime())) continue

          if (this.deduplicator.isDuplicate({
            provider: provider.name,
            sessionId: event.sessionId,
            timestamp: eventTime.toISOString(),
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            rawMessageId: (event as any).rawMessageId,
            bubbleId: (event as any).bubbleId,
            conversationId: (event as any).conversationId,
            responseId: (event as any).responseId,
          })) {
            continue
          }

          const inserted = this.db.insertEvent(event)
          if (inserted) {
            this.updateSession(event)
          }
          this.deduplicator.record({
            provider: provider.name,
            sessionId: event.sessionId,
            timestamp: eventTime.toISOString(),
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            cumulativeOutputTokens: (event as any).cumulativeOutputTokens,
            rawMessageId: (event as any).rawMessageId,
            bubbleId: (event as any).bubbleId,
            conversationId: (event as any).conversationId,
            responseId: (event as any).responseId,
          })

          if (this.onEvent) {
            this.onEvent(event)
          }
        } catch (err) {
          logger.error({ provider: provider.name, filePath, err }, 'Error processing line, skipping')
          continue
        }
      }
    }

    this.db.setWatcherState(filePath, end)
  }

  private updateSession(event: TokenEvent): void {
    const existing = this.db.getDatabase()
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(event.sessionId) as any
    const eventTime = event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp)

    let startedAt: Date
    if (existing && existing.started_at) {
      startedAt = new Date(existing.started_at)
    } else {
      startedAt = eventTime
    }

    const totalInputTokens = (existing?.total_input_tokens ?? 0) + event.inputTokens
    const totalOutputTokens = (existing?.total_output_tokens ?? 0) + event.outputTokens
    const totalCacheReadTokens = (existing?.total_cache_read_tokens ?? 0) + event.cacheReadTokens
    const totalCacheWriteTokens = (existing?.total_cache_write_tokens ?? 0) + event.cacheWriteTokens
    const totalTokens = (existing?.total_tokens ?? 0) + event.totalTokens
    const totalCostUsd = (existing?.total_cost_usd ?? 0) + event.costUsd
    const eventCount = (existing?.event_count ?? 0) + 1
    const modelsUsed = [...new Set([...(existing?.models_used ? JSON.parse(existing.models_used) : []), event.model])]
    const toolsUsed = event.toolName
      ? [...new Set([...(existing?.tools_used ? JSON.parse(existing.tools_used) : []), event.toolName])]
      : (existing?.tools_used ? JSON.parse(existing.tools_used) : [])

    const session = {
      id: event.sessionId,
      projectPath: event.projectPath,
      projectName: event.projectName,
      provider: event.provider,
      startedAt,
      endedAt: eventTime,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      totalTokens,
      totalCostUsd,
      eventCount,
      modelsUsed,
      toolsUsed,
    }

    this.db.insertOrUpdateSession(session)
  }

  stop(): void {
    for (const w of this.watchers) {
      w.close()
    }
    this.watchers = []
  }

  getProviders(): string[] {
    return this.providers.map((p) => p.name)
  }
}
