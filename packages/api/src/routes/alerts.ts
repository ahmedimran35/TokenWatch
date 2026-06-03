import { Router } from 'express'
import { z } from 'zod'
import { Database } from '@tokenwatch/collector'
import { loadAlertConfig, saveAlertConfig } from '@tokenwatch/engine'
import type { AlertConfig, BudgetUtilization } from '@tokenwatch/types'

const alertConfigSchema = z.object({
  dailyBudgetUsd: z.number().optional(),
  hourlyBudgetUsd: z.number().optional(),
  burnRateSpikeMultiplier: z.number().optional(),
  sessionBudgetUsd: z.number().optional(),
  slackWebhookUrl: z.string().optional(),
  discordWebhookUrl: z.string().optional(),
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

  router.get('/budget-utilization', (_req, res) => {
    const sqlite = db.getDatabase()
    const config = loadAlertConfig()
    const now = new Date()

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayRow = sqlite.prepare("SELECT COALESCE(SUM(cost_usd),0) as c FROM token_events WHERE timestamp >= ?").get(todayStart) as any
    const todaySpent = todayRow?.c ?? 0

    const hourStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const hourRow = sqlite.prepare("SELECT COALESCE(SUM(cost_usd),0) as c FROM token_events WHERE timestamp >= ?").get(hourStart) as any
    const hourSpent = hourRow?.c ?? 0

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthRow = sqlite.prepare("SELECT COALESCE(SUM(cost_usd),0) as c FROM token_events WHERE timestamp >= ?").get(monthStart) as any
    const monthSpent = monthRow?.c ?? 0

    const sessionRow = sqlite.prepare("SELECT total_cost_usd FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1").get() as any

    const dailyBudget = config.dailyBudgetUsd ?? 0
    const hourlyBudget = config.hourlyBudgetUsd ?? 0
    const monthlyBudget = dailyBudget * 30
    const sessionBudget = config.sessionBudgetUsd ?? 0

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const projectedMonthEnd = daysInMonth > 0 ? (monthSpent / dayOfMonth) * daysInMonth : 0

    const utilization: BudgetUtilization = {
      daily: {
        budget: dailyBudget,
        spent: todaySpent,
        remaining: Math.max(0, dailyBudget - todaySpent),
        percentage: dailyBudget > 0 ? Math.min(100, (todaySpent / dailyBudget) * 100) : 0,
      },
      hourly: {
        budget: hourlyBudget,
        spent: hourSpent,
        remaining: Math.max(0, hourlyBudget - hourSpent),
        percentage: hourlyBudget > 0 ? Math.min(100, (hourSpent / hourlyBudget) * 100) : 0,
      },
      monthly: {
        budget: monthlyBudget,
        spent: monthSpent,
        remaining: Math.max(0, monthlyBudget - monthSpent),
        percentage: monthlyBudget > 0 ? Math.min(100, (monthSpent / monthlyBudget) * 100) : 0,
      },
      currentSession: sessionRow
        ? {
            budget: sessionBudget,
            spent: sessionRow.total_cost_usd ?? 0,
            remaining: Math.max(0, sessionBudget - (sessionRow.total_cost_usd ?? 0)),
            percentage: sessionBudget > 0 ? Math.min(100, ((sessionRow.total_cost_usd ?? 0) / sessionBudget) * 100) : 0,
          }
        : null,
      projectedMonthEnd,
    }

    res.json(utilization)
  })

  return router
}
