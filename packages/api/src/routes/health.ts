import express from 'express'
import type { AnalyticsEngine } from '@tokenwatch/engine'

export function createHealthRouter(engine: AnalyticsEngine): express.Router {
  const router = express.Router()

  router.get('/waste', (req, res) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(0)
    const to = req.query.to ? new Date(req.query.to as string) : new Date()
    const report = engine.getContextWaste(from, to)
    res.json(report)
  })

  router.get('/zombies', (req, res) => {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 30
    const sessions = engine.getZombieSessions(threshold)
    res.json(sessions)
  })

  router.get('/scores', (req, res) => {
    const from = req.query.from ? new Date(req.query.from as string) : new Date(0)
    const to = req.query.to ? new Date(req.query.to as string) : new Date()
    const scores = engine.getSessionHealthScores(from, to)
    res.json(scores)
  })

  return router
}
