import { Database } from './database'

interface PlanConfig {
  type: string
  monthlyUsd: number
}

function getPlan(): PlanConfig | null {
  try {
    const configPath = require('path').join(require('os').homedir(), '.tokenwatch', 'config.json')
    const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'))
    return config.plan || null
  } catch {
    return null
  }
}

const PLAN_PRESETS: Record<string, { monthlyUsd: number; label: string }> = {
  'claude-max': { monthlyUsd: 200, label: 'Claude Max' },
  'claude-pro': { monthlyUsd: 20, label: 'Claude Pro' },
  'cursor-pro': { monthlyUsd: 20, label: 'Cursor Pro' },
  'claude-free': { monthlyUsd: 0, label: 'Claude Free' },
}

export interface PlanStatus {
  type: string
  label: string
  monthlyUsd: number
  currentMonthCost: number
  currentMonthTokens: number
  percentUsed: number
  daysRemaining: number
  projectedMonthEndCost: number
  dailyBudget: number
}

export function getPlanStatus(db: Database): PlanStatus | null {
  const plan = getPlan()
  if (!plan) return null

  const preset = PLAN_PRESETS[plan.type]
  const monthlyUsd = plan.monthlyUsd || preset?.monthlyUsd || 0
  const label = preset?.label || plan.type

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = daysInMonth - now.getDate()

  const internalDb = db.getDatabase()
  const row = internalDb
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) as total_cost, COALESCE(SUM(total_tokens), 0) as total_tokens
       FROM token_events WHERE timestamp >= ?`
    )
    .get(monthStart.toISOString()) as any

  const currentMonthCost = row?.total_cost ?? 0
  const currentMonthTokens = row?.total_tokens ?? 0

  const percentUsed = monthlyUsd > 0 ? (currentMonthCost / monthlyUsd) * 100 : 0
  const dailyBudget = monthlyUsd / daysInMonth
  const projectedMonthEndCost = now.getDate() > 0 ? (currentMonthCost / now.getDate()) * daysInMonth : 0

  return {
    type: plan.type,
    label,
    monthlyUsd,
    currentMonthCost,
    currentMonthTokens,
    percentUsed,
    daysRemaining,
    projectedMonthEndCost,
    dailyBudget,
  }
}
