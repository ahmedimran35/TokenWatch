import { Database } from './database'
import type { DailyStats } from '@tokenwatch/types'

export interface StatsResult {
  totalTokens: number
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  cacheHitRate: number
  sessionCount: number
  avgCostPerSession: number
  avgTokensPerSession: number
  dailyBreakdown: DailyStats[]
}

export function getStats(
  db: Database,
  options: {
    from: Date
    to: Date
    projectPath?: string
    provider?: string
  }
): StatsResult {
  const internalDb = (db as any).db ? (db as any).getDatabase() : db.getDatabase()

  let whereClause = 'WHERE timestamp >= ? AND timestamp <= ?'
  const params: any[] = [options.from.toISOString(), options.to.toISOString()]

  if (options.projectPath) {
    whereClause += ' AND project_path = ?'
    params.push(options.projectPath)
  }
  if (options.provider) {
    whereClause += ' AND provider = ?'
    params.push(options.provider)
  }

  const aggRow = internalDb
    .prepare(
      `SELECT
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COALESCE(SUM(cache_read_tokens), 0) as total_cache_read,
        COALESCE(SUM(cache_write_tokens), 0) as total_cache_write,
        COUNT(DISTINCT session_id) as session_count
       FROM token_events ${whereClause}`
    )
    .get(...params) as any

  const totalTokens = aggRow?.total_tokens ?? 0
  const totalInputTokens = aggRow?.total_input ?? 0
  const totalCacheReadTokens = aggRow?.total_cache_read ?? 0
  const cacheHitRate =
    totalInputTokens + totalCacheReadTokens > 0
      ? totalCacheReadTokens / (totalInputTokens + totalCacheReadTokens)
      : 0

  // Daily breakdown
  const dailyRows = internalDb
    .prepare(
      `SELECT
        date(timestamp) as date,
        SUM(total_tokens) as tokens,
        SUM(cost_usd) as cost,
        COUNT(DISTINCT session_id) as sessions,
        model as top_model,
        project_name as top_project
       FROM token_events ${whereClause}
       GROUP BY date(timestamp)
       ORDER BY date`
    )
    .all(...params) as Array<{
    date: string
    tokens: number
    cost: number
    sessions: number
    top_model: string
    top_project: string
  }>

  const dailyBreakdown: DailyStats[] = dailyRows.map((r) => ({
    date: r.date,
    totalTokens: r.tokens,
    totalCostUsd: r.cost,
    sessionCount: r.sessions,
    topModel: r.top_model,
    topProject: r.top_project,
  }))

  const sessionCount = aggRow?.session_count ?? 0

  return {
    totalTokens,
    totalCostUsd: aggRow?.total_cost ?? 0,
    totalInputTokens,
    totalOutputTokens: aggRow?.total_output ?? 0,
    totalCacheReadTokens,
    totalCacheWriteTokens: aggRow?.total_cache_write ?? 0,
    cacheHitRate,
    sessionCount,
    avgCostPerSession: sessionCount > 0 ? (aggRow?.total_cost ?? 0) / sessionCount : 0,
    avgTokensPerSession: sessionCount > 0 ? totalTokens / sessionCount : 0,
    dailyBreakdown,
  }
}

export function getToday(db: Database): StatsResult {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return getStats(db, { from: start, to: now })
}

export function getThisWeek(db: Database): StatsResult {
  const now = new Date()
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return getStats(db, { from: start, to: now })
}

export function getThisMonth(db: Database): StatsResult {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return getStats(db, { from: start, to: now })
}

export function getLast30Days(db: Database): StatsResult {
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return getStats(db, { from: start, to: now })
}

export function getAllTime(db: Database): StatsResult {
  return getStats(db, { from: new Date(0), to: new Date() })
}
