import { Database } from './database'
import type { ProjectStats } from '@tokenwatch/types'

export function getProjectStats(
  db: Database,
  options: { from: Date; to: Date; limit?: number }
): ProjectStats[] {
  const internalDb = db.getDatabase()
  const limit = options.limit ?? 20

  const rows = internalDb
    .prepare(
      `SELECT
        project_name,
        project_path,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_active
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY project_name, project_path
       ORDER BY total_cost DESC
       LIMIT ?`
    )
    .all(options.from.toISOString(), options.to.toISOString(), limit) as Array<{
    project_name: string
    project_path: string
    total_tokens: number
    total_cost: number
    session_count: number
    last_active: string
  }>

  return rows.map((r) => ({
    projectName: r.project_name,
    projectPath: r.project_path,
    totalTokens: r.total_tokens,
    totalCostUsd: r.total_cost,
    sessionCount: r.session_count,
    avgCostPerSession: r.session_count > 0 ? r.total_cost / r.session_count : 0,
    lastActiveAt: new Date(r.last_active),
  }))
}
