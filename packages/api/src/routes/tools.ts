import express from 'express'
import type { Router } from 'express'
import { AnalyticsEngine } from '@tokenwatch/engine'
import { getToolStats, getShellCommandStats, getActivityStats } from '@tokenwatch/engine'

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

export function createToolRoutes(engine: AnalyticsEngine, db: any): Router {
  const router: Router = express.Router()

  router.get('/', (_req, res) => {
    try {
      const stats = getToolStats(db, { from: safeDate(undefined, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), to: new Date() })
      res.json(stats)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  router.get('/shell-commands', (_req, res) => {
    try {
      const stats = getShellCommandStats(db, { from: safeDate(undefined, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), to: new Date() })
      res.json(stats)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  router.get('/activities', (_req, res) => {
    try {
      const stats = getActivityStats(db, { from: safeDate(undefined, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), to: new Date() })
      res.json(stats)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
