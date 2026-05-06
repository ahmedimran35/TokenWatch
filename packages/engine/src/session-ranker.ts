import { Database } from './database'
import type { Session, TokenEvent } from '@tokenwatch/types'

export function getTopSessions(
  db: Database,
  options: {
    from: Date
    to: Date
    limit?: number
    sortBy?: 'cost' | 'tokens' | 'duration'
  }
): Session[] {
  const internalDb = db.getDatabase()
  const limit = options.limit ?? 10

  const sortColumn =
    options.sortBy === 'tokens'
      ? 'total_tokens'
      : options.sortBy === 'duration'
        ? "(julianday(ended_at) - julianday(started_at))"
        : 'total_cost_usd'

  const rows = internalDb
    .prepare(
      `SELECT * FROM sessions
       WHERE started_at >= ? AND started_at <= ?
       ORDER BY ${sortColumn} DESC
       LIMIT ?`
    )
    .all(options.from.toISOString(), options.to.toISOString(), limit) as any[]

  return rows.map(rowToSession)
}

export function getSessionTimeline(db: Database, sessionId: string): TokenEvent[] {
  const internalDb = db.getDatabase()

  const rows = internalDb
    .prepare(
      `SELECT * FROM token_events
       WHERE session_id = ?
       ORDER BY timestamp ASC`
    )
    .all(sessionId) as any[]

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    projectPath: r.project_path,
    projectName: r.project_name,
    timestamp: new Date(r.timestamp),
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheReadTokens: r.cache_read_tokens,
    cacheWriteTokens: r.cache_write_tokens,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
    toolName: r.tool_name,
    toolInput: r.tool_input,
    durationMs: r.duration_ms,
    provider: r.provider,
  }))
}

function rowToSession(row: any): Session {
  return {
    id: row.id,
    projectPath: row.project_path,
    projectName: row.project_name,
    provider: row.provider,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalCacheReadTokens: row.total_cache_read_tokens,
    totalCacheWriteTokens: row.total_cache_write_tokens,
    totalTokens: row.total_tokens,
    totalCostUsd: row.total_cost_usd,
    eventCount: row.event_count,
    modelsUsed: JSON.parse(row.models_used),
    toolsUsed: JSON.parse(row.tools_used),
  }
}
