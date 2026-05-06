import { Router } from 'express'
import { Database } from '@tokenwatch/collector'
import type { TokenEvent } from '@tokenwatch/types'
import { z } from 'zod'

const eventSchema = z.object({
  userId: z.string(),
  events: z.array(z.object({
    id: z.string(),
    sessionId: z.string(),
    projectPath: z.string(),
    projectName: z.string(),
    timestamp: z.string(),
    model: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number(),
    cacheWriteTokens: z.number(),
    totalTokens: z.number(),
    costUsd: z.number(),
    toolName: z.string().optional(),
    provider: z.string().optional(),
  })),
  authToken: z.string(),
})

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

export function createTeamRouter(db: Database, teamSecret: string): Router {
  const router = Router()

  router.post('/events', (req, res) => {
    const result = eventSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    if (result.data.authToken !== teamSecret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const internalDb = db.getDatabase()
    const stmt = internalDb.prepare(`
      INSERT INTO team_events (id, user_id, session_id, project_name, timestamp, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_tokens, cost_usd, tool_name, provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    for (const event of result.data.events) {
      stmt.run(
        event.id,
        result.data.userId,
        event.sessionId,
        event.projectName,
        event.timestamp,
        event.model,
        event.inputTokens,
        event.outputTokens,
        event.cacheReadTokens,
        event.cacheWriteTokens,
        event.totalTokens,
        event.costUsd,
        event.toolName ?? null,
        event.provider ?? 'claude'
      )
      count++
    }

    res.json({ accepted: count })
  })

  router.get('/stats', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())

    const internalDb = db.getDatabase()

    const totalRow = internalDb
      .prepare('SELECT COALESCE(SUM(cost_usd), 0) as cost, COALESCE(SUM(total_tokens), 0) as tokens FROM team_events WHERE timestamp >= ? AND timestamp <= ?')
      .get(from.toISOString(), to.toISOString()) as any

    const byUser = internalDb
      .prepare(`
        SELECT user_id, COALESCE(SUM(cost_usd), 0) as cost, COALESCE(SUM(total_tokens), 0) as tokens,
          COUNT(DISTINCT session_id) as sessions
        FROM team_events WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY user_id ORDER BY cost DESC LIMIT 10`)
      .all(from.toISOString(), to.toISOString())

    res.json({
      totalCost: totalRow.cost,
      totalTokens: totalRow.tokens,
      byUser: byUser.map((r: any) => ({
        userId: r.user_id,
        totalCost: r.cost,
        totalTokens: r.tokens,
        sessionCount: r.sessions,
      })),
    })
  })

  router.get('/leaderboard', (_req, res) => {
    const internalDb = db.getDatabase()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const total = (internalDb.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM team_events WHERE timestamp >= ?').get(monthStart) as any).total

    const rows = internalDb
      .prepare(`
        SELECT user_id, COALESCE(SUM(cost_usd), 0) as cost
        FROM team_events WHERE timestamp >= ?
        GROUP BY user_id ORDER BY cost DESC LIMIT 10`)
      .all(monthStart)

    res.json(rows.map((r: any) => ({
      userId: r.user_id,
      cost: r.cost,
      percentage: total > 0 ? (r.cost / total) * 100 : 0,
    })))
  })

  return router
}