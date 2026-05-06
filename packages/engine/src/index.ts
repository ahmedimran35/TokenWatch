import { Database } from './database'
import type { LiveStats, TokenEvent, Session, Alert } from '@tokenwatch/types'
import { calculateBurnRate } from './burn-rate'
import { getToday, getThisMonth } from './aggregator'
import { getTopSessions } from './session-ranker'
import { evaluateAlerts, loadAlertConfig } from './alert-evaluator'

export class AnalyticsEngine {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  getLiveStats(): LiveStats {
    const today = getToday(this.db)
    const month = getThisMonth(this.db)
    const burnRate = calculateBurnRate(this.db, 5)

    // Get recent events
    const recentEvents = this.db
      .getDatabase()
      .prepare(
        `SELECT * FROM token_events ORDER BY timestamp DESC LIMIT 20`
      )
      .all() as any[]

    // Get active session (most recent without end)
    const activeSessionRow = this.db
      .getDatabase()
      .prepare(
        `SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
      )
      .get() as any

    // Get alerts
    const alertRows = this.db
      .getDatabase()
      .prepare(
        `SELECT * FROM alert_events WHERE acknowledged = 0 ORDER BY triggered_at DESC LIMIT 10`
      )
      .all() as any[]

    const providers = this.db
      .getDatabase()
      .prepare(`SELECT DISTINCT provider FROM token_events WHERE provider IS NOT NULL AND provider != ''`)
      .all()
      .map((r: any) => r.provider)

    return {
      burnRate,
      todayCost: today.totalCostUsd,
      todayTokens: today.totalTokens,
      monthCost: month.totalCostUsd,
      monthTokens: month.totalTokens,
      activeSession: activeSessionRow ? rowToSession(activeSessionRow) : undefined,
      recentEvents: recentEvents.map(rowToTokenEvent),
      alerts: alertRows.map(rowToAlert),
      providers,
    }
  }

  getStats = getToday
  getProjectStats = require('./project-stats').getProjectStats
  getModelStats = require('./model-stats').getModelStats
  getTopSessions = getTopSessions
  getSessionTimeline = require('./session-ranker').getSessionTimeline
  getCacheStats = require('./cache-stats').getCacheStats
  getBurnRateHistory = require('./burn-rate').getBurnRateHistory

  evaluateAlerts(): Alert[] {
    const config = loadAlertConfig()
    return evaluateAlerts(this.db, config)
  }

  getBurnRate(windowMinutes?: number) {
    return calculateBurnRate(this.db, windowMinutes)
  }
}

function rowToTokenEvent(r: any): TokenEvent {
  return {
    id: r.id,
    sessionId: r.session_id,
    projectPath: r.project_path,
    projectName: r.project_name,
    timestamp: new Date(r.timestamp),
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheReadTokens: r.cache_read_tokens,
    cacheWriteTokens: r.cache_write_tokens,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
    toolName: r.tool_name,
    toolInput: r.tool_input,
    durationMs: r.duration_ms,
    provider: r.provider,
  }
}

function rowToSession(r: any): Session {
  return {
    id: r.id,
    projectPath: r.project_path,
    projectName: r.project_name,
    provider: r.provider,
    startedAt: new Date(r.started_at),
    endedAt: r.ended_at ? new Date(r.ended_at) : undefined,
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

function rowToAlert(r: any): Alert {
  return {
    id: r.id,
    type: r.type,
    threshold: r.threshold,
    currentValue: r.current_value,
    triggeredAt: new Date(r.triggered_at),
    acknowledged: !!r.acknowledged,
    message: r.message,
  }
}

export * from './burn-rate'
export * from './aggregator'
export * from './project-stats'
export * from './model-stats'
export * from './session-ranker'
export * from './alert-evaluator'
export * from './cache-stats'
export * from './tool-stats'
export * from './forecast'
export * from './classifier'
export * from './model-compare'
export * from './optimize'
export * from './yield'
export * from './plan'
