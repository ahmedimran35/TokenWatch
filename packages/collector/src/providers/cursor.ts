import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import type { TokenEvent } from '@tokenwatch/types'
import { calculateCost } from '../pricing'
import { getModelAliases } from '../config'

export interface CursorSession {
  id: string
  projectPath: string
  projectName: string
  model: string
  timestamp: Date
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  toolName: string
  toolInput: string
}

function findCursorDb(): string | null {
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(os.homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'Cursor', 'User', 'globalStorage', 'state.vscdb') : null,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function readCursorDb(dbPath: string): Record<string, string> {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })
    const rows = db.prepare(
      "SELECT key, value FROM ItemTable WHERE key LIKE 'cursorDiskKV%'"
    ).all() as Array<{ key: string; value: string }>
    db.close()

    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.key] = row.value
    }
    return result
  } catch {
    return {}
  }
}

function parseCursorEntries(entries: Record<string, string>): CursorSession[] {
  const sessions: CursorSession[] = []
  const aliases = getModelAliases()

  for (const [key, value] of Object.entries(entries)) {
    if (!key.startsWith('cursorDiskKV:bubbleId:')) continue

    try {
      const data = JSON.parse(value)
      const parts = key.split(':')
      const bubbleId = parts[parts.length - 1]

      const model = data.model || 'cursor-auto'
      const usage = data.usage || {}
      const inputTokens = usage.input_tokens || usage.prompt_tokens || 0
      const outputTokens = usage.output_tokens || usage.completion_tokens || 0
      const cacheReadTokens = usage.cache_read_tokens || usage.cached_prompt_tokens || 0
      const cacheWriteTokens = usage.cache_write_tokens || usage.cache_creation_tokens || 0
      const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens

      const costUsd = calculateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, aliases)

      // Extract tool info from content
      let toolName = ''
      let toolInput = ''
      if (data.content) {
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            toolName = block.name || ''
            toolInput = JSON.stringify(block.input || {})
            break
          }
        }
      }

      // Extract project path from metadata
      let projectPath = 'cursor'
      let projectName = 'cursor'
      if (data.metadata?.projectPath) {
        projectPath = data.metadata.projectPath
        projectName = path.basename(projectPath)
      }

      sessions.push({
        id: `cursor:${bubbleId}`,
        projectPath,
        projectName,
        model,
        timestamp: new Date(data.timestamp || Date.now()),
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        totalTokens,
        costUsd,
        toolName,
        toolInput,
      })
    } catch {
      // skip malformed entries
    }
  }

  return sessions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export function collectCursorSessions(): CursorSession[] {
  const dbPath = findCursorDb()
  if (!dbPath) return []

  const entries = readCursorDb(dbPath)
  return parseCursorEntries(entries)
}

export function cursorSessionsToEvents(sessions: CursorSession[]): TokenEvent[] {
  return sessions.map((s) => ({
    id: s.id,
    sessionId: s.projectPath,
    projectPath: s.projectPath,
    projectName: s.projectName,
    provider: 'cursor',
    timestamp: s.timestamp,
    model: s.model,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    cacheReadTokens: s.cacheReadTokens,
    cacheWriteTokens: s.cacheWriteTokens,
    totalTokens: s.totalTokens,
    costUsd: s.costUsd,
    toolName: s.toolName || undefined,
    toolInput: s.toolInput || undefined,
    bubbleId: s.id.split(':')[1],
  }))
}
