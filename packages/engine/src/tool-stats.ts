import { Database } from './database'
import { getActivityStatsWithClassification } from './classifier'

export interface ToolStat {
  name: string
  calls: number
  totalCostUsd: number
  totalTokens: number
}

export interface ShellCommandStat {
  command: string
  calls: number
  totalCostUsd: number
}

export interface ActivityStat {
  name: string
  calls: number
  totalCostUsd: number
  totalTokens: number
  oneShotRate?: number
}

export function getToolStats(db: Database, options: { from: Date; to: Date }): ToolStat[] {
  const internalDb = db.getDatabase()

  const rows = internalDb
    .prepare(
      `SELECT
        tool_name,
        COUNT(*) as calls,
        SUM(cost_usd) as total_cost,
        SUM(total_tokens) as total_tokens
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ? AND tool_name IS NOT NULL
       GROUP BY tool_name
       ORDER BY total_cost DESC`
    )
    .all(options.from.toISOString(), options.to.toISOString()) as Array<{
    tool_name: string
    calls: number
    total_cost: number
    total_tokens: number
  }>

  return rows
    .filter((r) => r.tool_name && r.tool_name.length > 0)
    .map((r) => ({
      name: r.tool_name,
      calls: r.calls,
      totalCostUsd: r.total_cost,
      totalTokens: r.total_tokens,
    }))
}

export function getShellCommandStats(db: Database, options: { from: Date; to: Date }): ShellCommandStat[] {
  const internalDb = db.getDatabase()

  const rows = internalDb.prepare(
    `SELECT tool_input, cost_usd FROM token_events
     WHERE timestamp >= ? AND timestamp <= ? AND tool_name = 'Bash' AND tool_input IS NOT NULL`
  ).all(options.from.toISOString(), options.to.toISOString()) as Array<{
    tool_input: string; cost_usd: number
  }>

  const cmdMap = new Map<string, { calls: number; cost: number }>()

  for (const e of rows) {
    const cmd = extractShellCommand('Bash', e.tool_input)
    if (!cmd) continue

    const existing = cmdMap.get(cmd) || { calls: 0, cost: 0 }
    existing.calls += 1
    existing.cost += e.cost_usd || 0
    cmdMap.set(cmd, existing)
  }

  return Array.from(cmdMap.entries())
    .map(([command, data]) => ({
      command,
      calls: data.calls,
      totalCostUsd: data.cost,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 15)
}

function extractShellCommand(toolName: string | undefined, toolInput: string | undefined): string | null {
  if (toolName !== 'Bash' || !toolInput) return null
  try {
    const parsed = JSON.parse(toolInput)
    const cmd = parsed.command || ''
    const mainCmd = cmd.trim().split(/[|\n;&]/)[0].trim().split(/\s+/)[0]
    const cleanCmd = mainCmd.includes('/') ? mainCmd.split('/').pop() || mainCmd : mainCmd
    return cleanCmd || null
  } catch {
    return null
  }
}

export function getActivityStats(db: Database, options: { from: Date; to: Date }): ActivityStat[] {
  const classified = getActivityStatsWithClassification(db, options)

  return classified.map((r) => ({
    name: r.name,
    calls: r.calls,
    totalCostUsd: r.totalCostUsd,
    totalTokens: r.totalTokens,
    oneShotRate: r.oneShotRate,
  }))
}
