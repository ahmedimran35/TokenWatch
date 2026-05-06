import { Router } from 'express'
import { getCacheStats } from '@tokenwatch/engine'
import { Database } from '@tokenwatch/collector'

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

export function createCacheRouter(db: Database): Router {
  const router = Router()

  router.get('/stats', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    res.json(getCacheStats(db, { from, to }))
  })

  return router
}
