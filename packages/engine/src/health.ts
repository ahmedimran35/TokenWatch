import type { Database } from './database'

export interface ContextWasteReport {
  totalInputTokens: number
  totalOutputTokens: number
  totalWastedTokens: number
  totalWastedCostUsd: number
  wastePercentage: number
  sessionsWithHighWaste: Array<{
    sessionId: string
    projectPath: string
    projectName: string
    inputTokens: number
    outputTokens: number
    wastedTokens: number
    wastedCostUsd: number
    wasteRatio: number
  }>
}

export interface SessionHealthScore {
  sessionId: string
  projectPath: string
  projectName: string
  score: number
  status: 'healthy' | 'average' | 'poor' | 'stuck'
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  outputInputRatio: number
  toolUseRate: number
  durationMs: number
  eventCount: number
  flags: string[]
}

export interface ZombieSession {
  sessionId: string
  projectPath: string
  projectName: string
  provider: string
  startedAt: string
  lastActivityAt: string
  idleMinutes: number
  tokensDuringIdle: number
  costDuringIdle: number
  totalTokens: number
  totalCostUsd: number
  status: 'idle' | 'likely-loop' | 'context-refresh-spam'
  recommendation: string
}

export function getContextWasteReport(db: Database, from: Date, to: Date): ContextWasteReport {
  const sqliteDb = db.getDatabase()
  const fromStr = from.toISOString()
  const toStr = to.toISOString()

  const aggRow = sqliteDb.prepare(`
    SELECT
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output,
      COALESCE(SUM(cost_usd), 0) as total_cost
    FROM token_events
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(fromStr, toStr) as any

  const totalInput = aggRow?.total_input ?? 0
  const totalOutput = aggRow?.total_output ?? 0
  const totalCost = aggRow?.total_cost ?? 0

  const wastedTokens = Math.max(totalInput - totalOutput, 0)
  const wastePercentage = totalInput > 0 ? (wastedTokens / totalInput) * 100 : 0
  const avgCostPerToken = totalInput > 0 ? totalCost / totalInput : 0
  const wastedCostUsd = wastedTokens * avgCostPerToken

  const highWasteSessions = sqliteDb.prepare(`
    SELECT
      s.id, s.project_path, s.project_name,
      s.total_input_tokens, s.total_output_tokens,
      s.total_cost_usd, s.event_count
    FROM sessions s
    WHERE s.started_at >= ? AND s.started_at <= ?
      AND s.total_input_tokens > 1000
      AND (s.total_output_tokens * 1.0 / s.total_input_tokens) < 0.15
    ORDER BY (s.total_input_tokens - s.total_output_tokens) DESC
    LIMIT 10
  `).all(fromStr, toStr) as any[]

  const sessionsWithHighWaste = (highWasteSessions || []).map((s) => {
    const wasted = Math.max(s.total_input_tokens - s.total_output_tokens, 0)
    const ratio = s.total_input_tokens > 0 ? wasted / s.total_input_tokens : 0
    return {
      sessionId: s.id,
      projectPath: s.project_path,
      projectName: s.project_name,
      inputTokens: s.total_input_tokens,
      outputTokens: s.total_output_tokens,
      wastedTokens: wasted,
      wastedCostUsd: wasted * (s.total_input_tokens > 0 ? s.total_cost_usd / s.total_input_tokens : 0),
      wasteRatio: ratio,
    }
  })

  return {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalWastedTokens: wastedTokens,
    totalWastedCostUsd: wastedCostUsd,
    wastePercentage,
    sessionsWithHighWaste,
  }
}

export function getZombieSessions(db: Database, thresholdMinutes = 30): ZombieSession[] {
  const sqliteDb = db.getDatabase()
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString()

  const sessions = sqliteDb.prepare(`
    SELECT
      s.id, s.project_path, s.project_name, s.provider,
      s.started_at, s.ended_at,
      s.total_input_tokens, s.total_output_tokens,
      s.total_cost_usd, s.event_count,
      MAX(te.timestamp) as last_activity,
      COUNT(te.id) as event_count
    FROM sessions s
    LEFT JOIN token_events te ON te.session_id = s.id
    WHERE s.ended_at IS NULL
      AND s.started_at < ?
    GROUP BY s.id
    HAVING MAX(te.timestamp) < ? OR MAX(te.timestamp) IS NULL
    ORDER BY MAX(te.timestamp) ASC
    LIMIT 20
  `).all(cutoff, cutoff) as any[]

  const now = new Date()

  return (sessions || []).map((s) => {
    const lastActivity = s.last_activity ? new Date(s.last_activity) : new Date(s.started_at)
    const idleMs = now.getTime() - lastActivity.getTime()
    const idleMinutes = Math.round(idleMs / 60000)

    const eventsAfterCutoff = sqliteDb.prepare(`
      SELECT COALESCE(SUM(total_tokens), 0) as idle_tokens,
             COALESCE(SUM(cost_usd), 0) as idle_cost,
             COUNT(*) as event_count
      FROM token_events
      WHERE session_id = ? AND timestamp >= ?
    `).get(s.id, cutoff) as any

    const tokensDuringIdle = eventsAfterCutoff?.idle_tokens ?? 0
    const costDuringIdle = eventsAfterCutoff?.idle_cost ?? 0

    const contextRefreshEvents = sqliteDb.prepare(`
      SELECT COUNT(*) as count
      FROM token_events
      WHERE session_id = ? AND timestamp >= ?
        AND tool_name IS NULL AND output_tokens = 0 AND input_tokens > 0
    `).get(s.id, cutoff) as any

    const contextRefreshes = contextRefreshEvents?.count ?? 0

    let status: ZombieSession['status'] = 'idle'
    let recommendation = `Session idle for ${idleMinutes}m. Consider closing to prevent context refresh costs.`

    if (contextRefreshes >= 3) {
      status = 'context-refresh-spam'
      recommendation = `Session has refreshed context ${contextRefreshes} times while idle. Close it — each refresh costs tokens.`
    } else if (idleMinutes > 120 && tokensDuringIdle > 5000) {
      status = 'likely-loop'
      recommendation = `Session burned ${tokensDuringIdle} tokens while idle for ${idleMinutes}m. Likely stuck in a loop — kill it now.`
    }

    return {
      sessionId: s.id,
      projectPath: s.project_path,
      projectName: s.project_name,
      provider: s.provider,
      startedAt: s.started_at,
      lastActivityAt: lastActivity.toISOString(),
      idleMinutes,
      tokensDuringIdle,
      costDuringIdle,
      totalTokens: s.total_input_tokens + s.total_output_tokens,
      totalCostUsd: s.total_cost_usd,
      status,
      recommendation,
    }
  })
}

export function getSessionHealthScores(db: Database, from: Date, to: Date): SessionHealthScore[] {
  const sqliteDb = db.getDatabase()
  const fromStr = from.toISOString()
  const toStr = to.toISOString()

  const sessions = sqliteDb.prepare(`
    SELECT
      s.id, s.project_path, s.project_name,
      s.total_input_tokens, s.total_output_tokens,
      s.total_cost_usd, s.total_tokens, s.event_count,
      s.started_at, s.ended_at,
      s.tools_used,
      CASE
        WHEN s.ended_at IS NOT NULL THEN
          (julianday(s.ended_at) - julianday(s.started_at)) * 86400000
        ELSE
          (julianday('now') - julianday(s.started_at)) * 86400000
      END as duration_ms
    FROM sessions s
    WHERE s.started_at >= ? AND s.started_at <= ?
      AND s.total_input_tokens > 0
    ORDER BY s.started_at DESC
    LIMIT 50
  `).all(fromStr, toStr) as any[]

  return (sessions || []).map((s) => {
    const input = s.total_input_tokens || 0
    const output = s.total_output_tokens || 0
    const ratio = input > 0 ? output / input : 0
    const durationMs = Math.min(s.duration_ms || 0, 86400000)

    const toolsUsed = JSON.parse(s.tools_used || '[]') as string[]
    const toolUseRate = s.event_count > 0 ? toolsUsed.length / s.event_count : 0
    const hasToolUse = toolsUsed.length > 0

    const flags: string[] = []
    let score = 0

    const ratioScore = Math.min(ratio * 200, 40)
    score += ratioScore

    if (hasToolUse) {
      score += Math.min(toolUseRate * 100, 25)
    }

    if (input > 0 && s.total_cost_usd > 0) {
      const costPerOutputToken = output > 0 ? s.total_cost_usd / output : 0
      if (costPerOutputToken < 0.0001) score += 20
      else if (costPerOutputToken < 0.001) score += 15
      else if (costPerOutputToken < 0.01) score += 10
      else score += 5
    }

    if (durationMs > 0 && output > 0) {
      const tokensPerMinute = (output / durationMs) * 60000
      if (tokensPerMinute > 100) score += 15
      else if (tokensPerMinute > 50) score += 10
      else if (tokensPerMinute > 10) score += 5
    }

    score = Math.min(Math.round(score), 100)

    let status: SessionHealthScore['status']
    if (score >= 70) status = 'healthy'
    else if (score >= 40) status = 'average'
    else if (score >= 20) status = 'poor'
    else status = 'stuck'

    if (ratio < 0.05) flags.push('Almost no output vs input — session may be stuck')
    if (ratio < 0.05 && input > 10000) flags.push('High input, near-zero output — likely infinite loop')
    if (!hasToolUse && input > 5000) flags.push('No tool usage despite heavy input — passive session')
    if (s.total_cost_usd > 5 && ratio < 0.1) flags.push(`Costly session ($${s.total_cost_usd.toFixed(2)}) with poor efficiency`)
    if (durationMs > 3600000 && output < 1000) flags.push('Long session with minimal output')

    return {
      sessionId: s.id,
      projectPath: s.project_path,
      projectName: s.project_name,
      score,
      status,
      totalCostUsd: s.total_cost_usd,
      totalInputTokens: input,
      totalOutputTokens: output,
      outputInputRatio: ratio,
      toolUseRate,
      durationMs,
      eventCount: s.event_count,
      flags,
    }
  })
}
