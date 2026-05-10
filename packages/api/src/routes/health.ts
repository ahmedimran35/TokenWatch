import { Router } from 'express'
import type { AnalyticsEngine } from '@tokenwatch/engine'

function safeDate(val: unknown, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? fallback : d
}

function safeInt(val: unknown, fallback: number): number {
  if (!val) return fallback
  const n = parseInt(val as string, 10)
  return isNaN(n) ? fallback : n
}

export function createHealthRouter(engine: AnalyticsEngine): Router {
  const router = Router()

  router.get('/waste', (req, res) => {
    try {
      const from = safeDate(req.query.from, new Date(0))
      const to = safeDate(req.query.to, new Date())
      const report = engine.getContextWaste(from, to)
      res.json(report)
    } catch (err) {
      res.status(500).json({ error: 'Failed to analyze context waste' })
    }
  })

  router.get('/zombies', (req, res) => {
    try {
      const threshold = safeInt(req.query.threshold, 30)
      const sessions = engine.getZombieSessions(threshold)
      res.json(sessions)
    } catch (err) {
      res.status(500).json({ error: 'Failed to detect zombie sessions' })
    }
  })

  router.get('/scores', (req, res) => {
    try {
      const from = safeDate(req.query.from, new Date(0))
      const to = safeDate(req.query.to, new Date())
      const scores = engine.getSessionHealthScores(from, to)
      res.json(scores)
    } catch (err) {
      res.status(500).json({ error: 'Failed to compute health scores' })
    }
  })

  return router
}
