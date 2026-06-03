import { Database } from './database'
import type { Alert, AlertConfig } from '@tokenwatch/types'
import { sendNotifications } from './notifier'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export function evaluateAlerts(db: Database, config: AlertConfig): Alert[] {
  const internalDb = db.getDatabase()
  const alerts: Alert[] = []
  const now = new Date()
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

  // Check daily budget
  if (config.dailyBudgetUsd !== undefined) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayCostRow = internalDb
      .prepare("SELECT COALESCE(SUM(cost_usd), 0) as cost FROM token_events WHERE timestamp >= ?")
      .get(todayStart) as any
    const todayCost = todayCostRow?.cost ?? 0

    if (todayCost >= config.dailyBudgetUsd && !recentAlertExists(internalDb, 'budget_daily', thirtyMinAgo)) {
      alerts.push({
        id: `budget_daily-${now.getTime()}`,
        type: 'budget_daily',
        threshold: config.dailyBudgetUsd,
        currentValue: todayCost,
        triggeredAt: now,
        acknowledged: false,
        message: `Daily budget exceeded: $${todayCost.toFixed(4)} / $${config.dailyBudgetUsd}`,
      })
    }
  }

  // Check hourly budget
  if (config.hourlyBudgetUsd !== undefined) {
    const hourStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const hourCostRow = internalDb
      .prepare("SELECT COALESCE(SUM(cost_usd), 0) as cost FROM token_events WHERE timestamp >= ?")
      .get(hourStart) as any
    const hourCost = hourCostRow?.cost ?? 0

    if (hourCost >= config.hourlyBudgetUsd && !recentAlertExists(internalDb, 'budget_hourly', thirtyMinAgo)) {
      alerts.push({
        id: `budget_hourly-${now.getTime()}`,
        type: 'budget_hourly',
        threshold: config.hourlyBudgetUsd,
        currentValue: hourCost,
        triggeredAt: now,
        acknowledged: false,
        message: `Hourly budget exceeded: $${hourCost.toFixed(4)} / $${config.hourlyBudgetUsd}`,
      })
    }
  }

  // Check burn rate spike
  if (config.burnRateSpikeMultiplier !== undefined) {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const currentBurnRow = internalDb
      .prepare("SELECT COALESCE(SUM(total_tokens), 0) as tokens FROM token_events WHERE timestamp >= ?")
      .get(fiveMinAgo) as any
    const currentBurn = currentBurnRow?.tokens ?? 0

    const avgBurnRow = internalDb
      .prepare(
        `SELECT COALESCE(AVG(tokens), 0) as avg FROM (
          SELECT SUM(total_tokens) as tokens FROM token_events
          WHERE timestamp >= ?
          GROUP BY strftime('%Y-%m-%d %H:%M', timestamp)
        )`
      )
      .get(sevenDaysAgo) as any
    const avgBurn = avgBurnRow?.avg ?? 0

    if (avgBurn > 0 && currentBurn > avgBurn * config.burnRateSpikeMultiplier &&
        !recentAlertExists(internalDb, 'burn_rate_spike', thirtyMinAgo)) {
      alerts.push({
        id: `burn_rate_spike-${now.getTime()}`,
        type: 'burn_rate_spike',
        threshold: avgBurn * config.burnRateSpikeMultiplier,
        currentValue: currentBurn,
        triggeredAt: now,
        acknowledged: false,
        message: `Burn rate spike detected: ${currentBurn} tokens (threshold: ${Math.round(avgBurn * config.burnRateSpikeMultiplier)})`,
      })
    }
  }

  // Check session budget
  if (config.sessionBudgetUsd !== undefined) {
    const row = internalDb
      .prepare(
        `SELECT id, total_cost_usd FROM sessions
         WHERE ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`
      )
      .get() as any

    if (row && row.total_cost_usd >= config.sessionBudgetUsd &&
        !recentAlertExists(internalDb, 'session_cost', thirtyMinAgo)) {
      alerts.push({
        id: `session_cost-${now.getTime()}`,
        type: 'session_cost',
        threshold: config.sessionBudgetUsd,
        currentValue: row.total_cost_usd,
        triggeredAt: now,
        acknowledged: false,
        message: `Session cost exceeded: $${row.total_cost_usd.toFixed(4)} / $${config.sessionBudgetUsd}`,
      })
    }
  }

  // Insert triggered alerts and send notifications
  for (const alert of alerts) {
    internalDb.prepare(
      `INSERT INTO alert_events (id, type, threshold, current_value, triggered_at, acknowledged, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      alert.id,
      alert.type,
      alert.threshold,
      alert.currentValue,
      alert.triggeredAt.toISOString(),
      alert.acknowledged ? 1 : 0,
      alert.message
    )
    sendNotifications(config, alert)
  }

  return alerts
}

function recentAlertExists(db: any, type: string, since: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM alert_events WHERE type = ? AND triggered_at >= ? LIMIT 1")
    .get(type, since)
  return !!row
}

export function loadAlertConfig(configPath?: string): AlertConfig {
  const fullPath = configPath ?? path.join(os.homedir(), '.tokenwatch', 'config.json')
  const defaults: AlertConfig = { dailyBudgetUsd: 10, burnRateSpikeMultiplier: 3 }
  if (!fs.existsSync(fullPath)) {
    return defaults
  }
  try {
    const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
    return {
      dailyBudgetUsd: raw.dailyBudgetUsd ?? defaults.dailyBudgetUsd,
      hourlyBudgetUsd: raw.hourlyBudgetUsd,
      burnRateSpikeMultiplier: raw.burnRateSpikeMultiplier ?? defaults.burnRateSpikeMultiplier,
      sessionBudgetUsd: raw.sessionBudgetUsd,
      slackWebhookUrl: raw.slackWebhookUrl,
      discordWebhookUrl: raw.discordWebhookUrl,
      webhookUrl: raw.webhookUrl,
      emailAddress: raw.emailAddress,
    }
  } catch {
    return defaults
  }
}

export function saveAlertConfig(config: AlertConfig, configPath?: string): void {
  const fullPath = configPath ?? path.join(os.homedir(), '.tokenwatch', 'config.json')
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  let existing: Record<string, any> = {}
  try {
    existing = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
  } catch {
    // no existing config
  }
  fs.writeFileSync(fullPath, JSON.stringify({ ...existing, ...config }, null, 2), { mode: 0o600 })
}
