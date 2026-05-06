import { Database } from './database'
import { classifyTool, ActivityCategory, detectEditCycles, ToolSequence } from './classifier'

export interface ModelComparison {
  models: ModelMetric[]
  categoryComparison: CategoryModelComparison[]
  period: { from: Date; to: Date }
}

export interface ModelMetric {
  model: string
  totalCostUsd: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  callCount: number
  editCount: number
  avgCostPerCall: number
  avgCostPerEdit: number
  avgOutputTokensPerCall: number
  cacheHitRate: number
  oneShotRate: number
  retryRate: number
  selfCorrectionRate: number
  delegationRate: number
  planningRate: number
  avgToolsPerTurn: number
  sessionCount: number
}

export interface CategoryModelComparison {
  category: string
  models: Array<{
    model: string
    calls: number
    oneShotRate: number
    totalCostUsd: number
  }>
}

function countDistinctSessions(events: any[]): number {
  const sessions = new Set<string>()
  for (const e of events) {
    if (e.sessionId) sessions.add(e.sessionId)
  }
  return sessions.size
}

function countEditCycles(sequences: ToolSequence[]): { total: number; successful: number } {
  const cycles = detectEditCycles(sequences)
  let total = cycles.length
  let successful = cycles.filter((c: { succeeded: boolean }) => c.succeeded).length
  return { total, successful }
}

function tsMs(val: string | Date | number): number {
  if (val instanceof Date) return val.getTime()
  if (typeof val === 'number') return val
  return new Date(val).getTime()
}

function calculateSelfCorrectionRate(events: any[]): number {
  let corrections = 0
  let totalTurns = 0

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1]
    const curr = events[i]

    if (prev.toolName === 'Bash' && curr.toolName && ['Edit', 'Write'].includes(curr.toolName)) {
      const bashOutput = prev.toolInput || ''
      if (bashOutput.toLowerCase().includes('error') || bashOutput.toLowerCase().includes('fail')) {
        totalTurns++
        corrections++
      }
    }

    if (curr.toolName && ['Edit', 'Write'].includes(curr.toolName)) {
      totalTurns++
    }
  }

  return totalTurns > 0 ? corrections / totalTurns : 0
}

function calculateRetryRate(events: any[]): number {
  const editEvents = events.filter((e) => e.toolName && ['Edit', 'Write', 'NotebookEdit'].includes(e.toolName))

  if (editEvents.length === 0) return 0

  let retries = 0
  let editCount = editEvents.length

  for (let i = 1; i < editEvents.length; i++) {
    const prevSession = editEvents[i - 1].sessionId
    const currSession = editEvents[i].sessionId
    const prevModel = editEvents[i - 1].model
    const currModel = editEvents[i].model

    if (prevSession === currSession && prevModel === currModel) {
      const timeDiff = Math.abs(tsMs(editEvents[i].timestamp) - tsMs(editEvents[i - 1].timestamp))

      if (timeDiff < 30000) {
        retries++
        editCount++
      }
    }
  }

  return editCount > 0 ? retries / editCount : 0
}

export function compareModels(db: Database, options: { from: Date; to: Date }): ModelComparison {
  const internalDb = db.getDatabase()
  const from = options.from
  const to = options.to

  const rows = internalDb
    .prepare(
      `SELECT * FROM token_events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC`
    )
    .all(from.toISOString(), to.toISOString()) as any[]

  const normalize = (r: any) => ({
    ...r,
    sessionId: r.session_id,
    projectPath: r.project_path,
    projectName: r.project_name,
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
  })

  const modelEvents = new Map<string, any[]>()
  for (const event of rows.map(normalize)) {
    const model = event.model || 'unknown'
    const existing = modelEvents.get(model) || []
    existing.push(event)
    modelEvents.set(model, existing)
  }

  const modelMetrics: ModelMetric[] = []

  for (const [model, modelEvts] of modelEvents) {
    const totalInputTokens = modelEvts.reduce((sum, e) => sum + (e.inputTokens || 0), 0)
    const totalOutputTokens = modelEvts.reduce((sum, e) => sum + (e.outputTokens || 0), 0)
    const totalCacheRead = modelEvts.reduce((sum, e) => sum + (e.cacheReadTokens || 0), 0)
    const totalCacheWrite = modelEvts.reduce((sum, e) => sum + (e.cacheWriteTokens || 0), 0)
    const totalTokens = totalInputTokens + totalOutputTokens + totalCacheRead + totalCacheWrite
    const totalCost = modelEvts.reduce((sum, e) => sum + (e.costUsd || 0), 0)

    const editEvents = modelEvts.filter((e) => e.toolName && ['Edit', 'Write', 'NotebookEdit'].includes(e.toolName))
    const editCount = editEvents.length

    const delegationEvents = modelEvts.filter((e) => e.toolName && ['TaskCreate', 'TaskUpdate', 'Agent'].includes(e.toolName))
    const planningEvents = modelEvts.filter((e) => e.toolName === 'TaskCreate')

    const sequences: ToolSequence[] = modelEvts
      .map((e: any) => ({
        toolName: e.toolName,
        toolInput: e.toolInput,
        timestamp: tsMs(e.timestamp).toString(),
        costUsd: e.costUsd || 0,
        totalTokens: e.totalTokens || 0,
      }))

    const { total: editCycles, successful: successfulCycles } = countEditCycles(sequences)

    const oneShotRate = editCycles > 0 ? successfulCycles / editCycles : 1
    const retryRate = calculateRetryRate(modelEvts)
    const selfCorrectionRate = calculateSelfCorrectionRate(modelEvts)

    const delegationRate = modelEvts.length > 0 ? delegationEvents.length / modelEvts.length : 0
    const planningRate = modelEvts.length > 0 ? planningEvents.length / modelEvts.length : 0

    const avgToolsPerTurn = modelEvts.length > 0
      ? modelEvts.filter((e) => e.toolName).length / modelEvts.length
      : 0

    const cacheHitRate = totalInputTokens + totalCacheRead > 0
      ? totalCacheRead / (totalInputTokens + totalCacheRead)
      : 0

    modelMetrics.push({
      model,
      totalCostUsd: totalCost,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens: totalCacheRead,
      totalCacheWriteTokens: totalCacheWrite,
      callCount: modelEvts.length,
      editCount,
      avgCostPerCall: modelEvts.length > 0 ? totalCost / modelEvts.length : 0,
      avgCostPerEdit: editCount > 0 ? totalCost / editCount : 0,
      avgOutputTokensPerCall: modelEvts.length > 0 ? totalOutputTokens / modelEvts.length : 0,
      cacheHitRate,
      oneShotRate,
      retryRate,
      selfCorrectionRate,
      delegationRate,
      planningRate,
      avgToolsPerTurn,
      sessionCount: countDistinctSessions(modelEvts),
    })
  }

  modelMetrics.sort((a, b) => b.totalCostUsd - a.totalCostUsd)

  const categories: ActivityCategory[] = [
    'Coding', 'Exploration', 'Debugging', 'Feature Dev', 'Refactoring',
    'Testing', 'Planning', 'Delegation', 'Git Ops', 'Build/Deploy',
    'Brainstorming', 'Conversation', 'General',
  ]

  const categoryComparison: CategoryModelComparison[] = []

  for (const category of categories) {
    const categoryModelData = new Map<string, { calls: number; oneShotEdits: number; totalEdits: number; cost: number }>()

    for (const [model, modelEvts] of modelEvents) {
      let calls = 0
      let cost = 0
      let oneShotEdits = 0
      let totalEdits = 0

      for (const event of modelEvts) {
        const activity = classifyTool(event.toolName, event.toolInput)
        if (activity === category) {
          calls++
          cost += event.costUsd || 0

          if (event.toolName && ['Edit', 'Write', 'NotebookEdit'].includes(event.toolName)) {
            totalEdits++
            oneShotEdits++
          }
        }
      }

      if (calls > 0) {
        const modelSequences: ToolSequence[] = modelEvts
          .filter((e) => classifyTool(e.toolName, e.toolInput) === category)
          .map((e: any) => ({
            toolName: e.toolName,
            toolInput: e.toolInput,
            timestamp: tsMs(e.timestamp).toString(),
            costUsd: e.costUsd || 0,
            totalTokens: e.totalTokens || 0,
          }))

        const { total: cycles, successful } = countEditCycles(modelSequences)
        if (cycles > 0) {
          oneShotEdits = successful
          totalEdits = cycles
        }

        categoryModelData.set(model, {
          calls,
          oneShotEdits,
          totalEdits,
          cost,
        })
      }
    }

    if (categoryModelData.size > 0) {
      categoryComparison.push({
        category,
        models: Array.from(categoryModelData.entries()).map(([model, data]) => ({
          model,
          calls: data.calls,
          oneShotRate: data.totalEdits > 0 ? data.oneShotEdits / data.totalEdits : 1,
          totalCostUsd: data.cost,
        })),
      })
    }
  }

  return {
    models: modelMetrics,
    categoryComparison,
    period: { from: options.from, to: options.to },
  }
}
