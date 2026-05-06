import { Router } from 'express'
import { z } from 'zod'
import { Database } from '@tokenwatch/collector'
import { loadAlertConfig, saveAlertConfig } from '@tokenwatch/engine'
import type { AlertConfig } from '@tokenwatch/types'

const alertConfigSchema = z.object({
  dailyBudgetUsd: z.number().optional(),
  hourlyBudgetUsd: z.number().optional(),
  burnRateSpikeMultiplier: z.number().optional(),
  sessionBudgetUsd: z.number().optional(),
  slackWebhookUrl: z.string().optional(),
  webhookUrl: z.string().optional(),
  emailAddress: z.string().optional(),
})

export function createAlertsRouter(db: Database): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    const rows = db
      .getDatabase()
      .prepare('SELECT * FROM alert_events ORDER BY triggered_at DESC')
      .all()
    res.json(
      rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        threshold: r.threshold,
        currentValue: r.current_value,
        triggeredAt: r.triggered_at,
        acknowledged: !!r.acknowledged,
        message: r.message,
      }))
    )
  })

  router.post('/:id/acknowledge', (req, res) => {
    db.getDatabase()
      .prepare('UPDATE alert_events SET acknowledged = 1 WHERE id = ?')
      .run(req.params.id)
    res.json({ success: true })
  })

  router.get('/config', (_req, res) => {
    res.json(loadAlertConfig())
  })

  router.put('/config', (req, res) => {
    const result = alertConfigSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid config', details: result.error.format() })
    }
    saveAlertConfig(result.data as AlertConfig)
    res.json(result.data)
  })

  return router
}
