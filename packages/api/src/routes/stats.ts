import { Router } from 'express'
import { AnalyticsEngine, getStats, getBurnRateHistory, calculateForecast, compareModels, analyzeOptimizations, analyzeYield, getTopSessions } from '@tokenwatch/engine'
import { Database } from '@tokenwatch/collector'

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

function safeInt(val: string | undefined, fallback: number): number {
  if (!val) return fallback
  const n = parseInt(val, 10)
  return isNaN(n) ? fallback : n
}

export function createStatsRouter(engine: AnalyticsEngine, db: Database): Router {
  const router = Router()

  router.get('/live', (_req, res) => {
    res.json(engine.getLiveStats())
  })

  router.get('/overview', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    const stats = getStats(db, { from, to, projectPath: req.query.projectPath as string, provider: req.query.provider as string })
    res.json(stats)
  })

  router.get('/daily', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    const stats = getStats(db, { from, to })
    res.json(stats.dailyBreakdown)
  })

  router.get('/burn-rate-history', (req, res) => {
    const periodHours = Math.max(1, safeInt(req.query.periodHours as string, 24))
    const bucketMinutes = Math.max(1, safeInt(req.query.bucketMinutes as string, 5))
    res.json(getBurnRateHistory(db, periodHours, bucketMinutes))
  })

  router.get('/forecast', (_req, res) => {
    res.json(calculateForecast(db))
  })

  router.get('/model-compare', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    res.json(compareModels(db, { from, to }))
  })

  router.get('/optimize', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    res.json(analyzeOptimizations(db, { from, to }))
  })

  router.get('/yield', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    const projectPath = req.query.projectPath as string
    const sessions = getTopSessions(db, { from, to, limit: 1000, sortBy: 'cost' })
    const yieldData = analyzeYield(
      sessions.map((s) => ({
        id: s.id,
        projectPath: s.projectName,
        startedAt: new Date(s.startedAt),
        endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
        totalCostUsd: s.totalCostUsd,
        totalTokens: s.totalTokens,
      })),
      projectPath
    )
    res.json(yieldData)
  })

  return router
}
