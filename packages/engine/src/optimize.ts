import { Database } from './database'

export type FindingSeverity = 'critical' | 'warning' | 'info'
export type FindingStatus = 'new' | 'improving' | 'resolved'

export interface OptimizeFinding {
  id: string
  type: string
  title: string
  description: string
  estimatedTokensWasted: number
  estimatedCostUsd: number
  fix: string
  severity: FindingSeverity
  status: FindingStatus
  category: string
}

export interface OptimizeResult {
  findings: OptimizeFinding[]
  totalWastedTokens: number
  totalWastedCostUsd: number
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
}

function detectRepeatedFileReads(events: any[]): OptimizeFinding[] {
  const findings: OptimizeFinding[] = []

  const readEvents = events.filter((e) => e.toolName === 'Read' && e.toolInput)

  const fileReadCounts = new Map<string, { count: number; sessions: Set<string>; cost: number; tokens: number }>()

  for (const event of readEvents) {
    let filePath = ''
    try {
      const parsed = JSON.parse(event.toolInput)
      filePath = parsed.path || parsed.file_path || ''
    } catch {
      continue
    }

    if (!filePath) continue

    const existing = fileReadCounts.get(filePath) || {
      count: 0,
      sessions: new Set<string>(),
      cost: 0,
      tokens: 0,
    }

    existing.count++
    existing.sessions.add(event.sessionId)
    existing.cost += event.costUsd || 0
    existing.tokens += event.totalTokens || 0

    fileReadCounts.set(filePath, existing)
  }

  for (const [filePath, data] of fileReadCounts) {
    if (data.sessions.size >= 2 && data.count >= 4) {
      const wastedTokens = Math.floor(data.tokens * 0.5)
      const wastedCost = data.cost * 0.5

      findings.push({
        id: `repeated-read-${filePath.replace(/[^a-z0-9]/gi, '-')}`,
        type: 'repeated_file_read',
        title: `File read ${data.count} times across ${data.sessions.size} sessions`,
        description: `${filePath} was read repeatedly. Add key context to CLAUDE.md to avoid re-reading.`,
        estimatedTokensWasted: wastedTokens,
        estimatedCostUsd: wastedCost,
        fix: `Add to CLAUDE.md:\n\n## ${filePath}\n<Add key info from this file here>`,
        severity: data.sessions.size >= 3 ? 'critical' : 'warning',
        status: 'new',
        category: 'Context',
      })
    }
  }

  return findings
}

function detectLowReadEditRatio(events: any[]): OptimizeFinding[] {
  const findings: OptimizeFinding[] = []

  const readsPerSession = new Map<string, number>()
  const editsPerSession = new Map<string, number>()

  for (const event of events) {
    if (event.toolName === 'Read') {
      readsPerSession.set(event.sessionId, (readsPerSession.get(event.sessionId) || 0) + 1)
    }
    if (event.toolName && ['Edit', 'Write', 'NotebookEdit'].includes(event.toolName)) {
      editsPerSession.set(event.sessionId, (editsPerSession.get(event.sessionId) || 0) + 1)
    }
  }

  let totalReads = 0
  let totalEdits = 0

  for (const sessionId of editsPerSession.keys()) {
    const reads = readsPerSession.get(sessionId) || 0
    const edits = editsPerSession.get(sessionId) || 0

    totalReads += reads
    totalEdits += edits
  }

  if (totalEdits > 0 && totalReads / totalEdits < 0.5) {
    const wastedCost = totalEdits * 0.001
    const wastedTokens = totalEdits * 50

    findings.push({
      id: 'low-read-edit-ratio',
      type: 'low_read_edit_ratio',
      title: `Low Read:Edit ratio (${totalReads}:${totalEdits})`,
      description: 'Editing without reading files first leads to retries and wasted tokens. Agent should read files before modifying.',
      estimatedTokensWasted: wastedTokens,
      estimatedCostUsd: wastedCost,
      fix: 'In CLAUDE.md, add:\n\n- Always Read files before Edit or Write\n- Use Grep to find context before making changes',
      severity: 'warning',
      status: 'new',
      category: 'Workflow',
    })
  }

  return findings
}

function detectBloatedClaudeMd(events: any[]): OptimizeFinding[] {
  const findings: OptimizeFinding[] = []

  const writeEvents = events.filter((e) => e.toolName === 'Write' && e.toolInput)

  for (const event of writeEvents) {
    let filePath = ''
    let contentLength = 0

    try {
      const parsed = JSON.parse(event.toolInput)
      filePath = parsed.path || parsed.file_path || ''
      const content = parsed.content || parsed.text || ''
      contentLength = content.length
    } catch {
      continue
    }

    if (filePath.includes('CLAUDE.md') && contentLength > 5000) {
      const wastedTokens = Math.floor(contentLength / 4)
      const wastedCost = event.costUsd || 0

      findings.push({
        id: `bloated-claude-md-${filePath.replace(/[^a-z0-9]/gi, '-')}`,
        type: 'bloated_claude_md',
        title: `CLAUDE.md is ${Math.round(contentLength / 1000)}KB (${wastedTokens} tokens)`,
        description: 'Large CLAUDE.md files cost tokens on every API call. Keep it concise with only essential context.',
        estimatedTokensWasted: wastedTokens,
        estimatedCostUsd: wastedCost,
        fix: `Trim CLAUDE.md to under 2000 tokens:\n\nmv ${filePath} ${filePath}.bak\n# Create a concise version with only critical info`,
        severity: contentLength > 10000 ? 'critical' : 'warning',
        status: 'new',
        category: 'Context',
      })
    }
  }

  return findings
}

function detectUnusedTools(events: any[]): OptimizeFinding[] {
  const findings: OptimizeFinding[] = []

  const usedTools = new Set<string>()
  const allToolCalls = new Map<string, { count: number; cost: number; tokens: number }>()

  for (const event of events) {
    if (event.toolName) {
      usedTools.add(event.toolName)

      const data = allToolCalls.get(event.toolName) || { count: 0, cost: 0, tokens: 0 }
      data.count++
      data.cost += event.costUsd || 0
      data.tokens += event.totalTokens || 0
      allToolCalls.set(event.toolName, data)
    }
  }

  const expensiveRareTools = Array.from(allToolCalls.entries())
    .filter(([tool, data]) => data.count <= 2 && data.cost > 0)

  for (const [tool, data] of expensiveRareTools) {
    findings.push({
      id: `rare-tool-${tool.toLowerCase()}`,
      type: 'rare_tool',
      title: `Tool "${tool}" used only ${data.count} times ($${data.cost.toFixed(4)})`,
      description: `Rarely used tools still incur schema overhead each session.`,
      estimatedTokensWasted: data.tokens,
      estimatedCostUsd: data.cost,
      fix: `Review if ${tool} is needed. Remove from MCP config if unused.`,
      severity: 'info',
      status: 'new',
      category: 'MCP',
    })
  }

  return findings
}

function detectRetryLoops(events: any[]): OptimizeFinding[] {
  const findings: OptimizeFinding[] = []

  const sessionsWithRetries = new Map<string, { retries: number; cost: number; tokens: number }>()

  const sorted = [...events].sort((a, b) => {
    const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
    const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
    return tsA - tsB
  })

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    if (
      prev.sessionId === curr.sessionId &&
      prev.toolName && ['Edit', 'Write'].includes(prev.toolName) &&
      curr.toolName && ['Edit', 'Write'].includes(curr.toolName)
    ) {
      const timeDiff = Math.abs(
        (curr.timestamp instanceof Date ? curr.timestamp.getTime() : new Date(curr.timestamp).getTime()) -
        (prev.timestamp instanceof Date ? prev.timestamp.getTime() : new Date(prev.timestamp).getTime())
      )

      if (timeDiff < 30000) {
        const session = sessionsWithRetries.get(curr.sessionId) || { retries: 0, cost: 0, tokens: 0 }
        session.retries++
        session.cost += (curr.costUsd || 0) + (prev.costUsd || 0)
        session.tokens += (curr.totalTokens || 0) + (prev.totalTokens || 0)
        sessionsWithRetries.set(curr.sessionId, session)
      }
    }
  }

  let totalRetries = 0
  let totalWastedCost = 0
  let totalWastedTokens = 0

  for (const [sessionId, data] of sessionsWithRetries) {
    totalRetries += data.retries
    totalWastedCost += data.cost
    totalWastedTokens += data.tokens
  }

  if (totalRetries >= 3) {
    findings.push({
      id: 'retry-loops',
      type: 'retry_loops',
      title: `${totalRetries} retry loops detected across ${sessionsWithRetries.size} sessions`,
      description: 'Multiple edits in quick succession suggest the agent is struggling. Improve context or use a better model.',
      estimatedTokensWasted: totalWastedTokens,
      estimatedCostUsd: totalWastedCost,
      fix: 'In CLAUDE.md, add:\n\n- Be precise with file paths and line numbers\n- Read the file first to understand the current state\n- Make one focused edit at a time',
      severity: totalRetries >= 10 ? 'critical' : 'warning',
      status: 'new',
      category: 'Workflow',
    })
  }

  return findings
}

function calculateHealthGrade(findings: OptimizeFinding[]): 'A' | 'B' | 'C' | 'D' | 'F' {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const warningCount = findings.filter((f) => f.severity === 'warning').length

  const score = criticalCount * 3 + warningCount * 1

  if (score === 0) return 'A'
  if (score <= 2) return 'B'
  if (score <= 5) return 'C'
  if (score <= 8) return 'D'
  return 'F'
}

export function analyzeOptimizations(db: Database, options: { from: Date; to: Date }): OptimizeResult {
  const internalDb = db.getDatabase()

  const events = internalDb.prepare(
    `SELECT tool_name, tool_input, cost_usd, total_tokens, timestamp, session_id
     FROM token_events WHERE timestamp >= ? AND timestamp <= ?`
  ).all(options.from.toISOString(), options.to.toISOString()) as Array<{
    tool_name: string | null; tool_input: string | null; cost_usd: number; total_tokens: number; timestamp: string; session_id: string
  }>

  const filteredEvents = events.map((e) => ({
    toolName: e.tool_name,
    toolInput: e.tool_input,
    costUsd: e.cost_usd,
    totalTokens: e.total_tokens,
    timestamp: new Date(e.timestamp),
    sessionId: e.session_id,
  }))

  const findings: OptimizeFinding[] = []

  findings.push(...detectRepeatedFileReads(filteredEvents))
  findings.push(...detectLowReadEditRatio(filteredEvents))
  findings.push(...detectBloatedClaudeMd(filteredEvents))
  findings.push(...detectUnusedTools(filteredEvents))
  findings.push(...detectRetryLoops(filteredEvents))

  findings.sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)

  const totalWastedTokens = findings.reduce((sum, f) => sum + f.estimatedTokensWasted, 0)
  const totalWastedCostUsd = findings.reduce((sum, f) => sum + f.estimatedCostUsd, 0)
  const healthGrade = calculateHealthGrade(findings)

  const gradeDescriptions: Record<string, string> = {
    A: 'Excellent! Your setup is well-optimized.',
    B: 'Good setup with minor issues to address.',
    C: 'Moderate waste detected. Review findings to save tokens.',
    D: 'Significant waste. Several quick fixes available.',
    F: 'Critical issues. Immediate action recommended.',
  }

  return {
    findings,
    totalWastedTokens,
    totalWastedCostUsd,
    healthGrade,
    summary: gradeDescriptions[healthGrade],
  }
}
