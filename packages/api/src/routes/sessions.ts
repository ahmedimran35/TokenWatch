import { Router } from 'express'
import { getTopSessions, getSessionTimeline } from '@tokenwatch/engine'
import { Database } from '@tokenwatch/collector'

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

function safeInt(val: string | undefined, fallback: number): number {
  if (!val) return fallback
  const n = parseInt(val, 10)
  return isNaN(n) || n < 1 || n > 1000 ? fallback : n
}

export function createSessionsRouter(db: Database): Router {
  const router = Router()

  router.get('/', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    const limit = safeInt(req.query.limit as string, 10)
    const sortBy = (req.query.sortBy as 'cost' | 'tokens' | 'duration') || 'cost'
    res.json(getTopSessions(db, { from, to, limit, sortBy }))
  })

  router.get('/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ error: 'Invalid session ID' })
    }
    const row = db
      .getDatabase()
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as any
    if (!row) {
      return res.status(404).json({ error: 'Session not found' })
    }
    res.json({
      ...rowToSession(row),
      events: getSessionTimeline(db, sessionId),
    })
  })

  router.get('/:sessionId/events', (req, res) => {
    const sessionId = req.params.sessionId
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ error: 'Invalid session ID' })
    }
    res.json(getSessionTimeline(db, sessionId))
  })

  return router
}

function rowToSession(r: any) {
  return {
    id: r.id,
    projectPath: r.project_path,
    projectName: r.project_name,
    provider: r.provider,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    totalInputTokens: r.total_input_tokens,
    totalOutputTokens: r.total_output_tokens,
    totalCacheReadTokens: r.total_cache_read_tokens,
    totalCacheWriteTokens: r.total_cache_write_tokens,
    totalTokens: r.total_tokens,
    totalCostUsd: r.total_cost_usd,
    eventCount: r.event_count,
    modelsUsed: JSON.parse(r.models_used),
    toolsUsed: JSON.parse(r.tools_used),
  }
}
