import { Database } from './database'

export type ActivityCategory =
  | 'Coding'
  | 'Exploration'
  | 'Debugging'
  | 'Feature Dev'
  | 'Refactoring'
  | 'Testing'
  | 'Planning'
  | 'Delegation'
  | 'Git Ops'
  | 'Build/Deploy'
  | 'Brainstorming'
  | 'Conversation'
  | 'General'

export interface ToolSequence {
  toolName: string
  toolInput: string | undefined
  timestamp: string
  costUsd: number
  totalTokens: number
}

const TOOL_TO_PRIMARY_ACTIVITY: Record<string, ActivityCategory> = {
  Bash: 'Coding',
  Read: 'Exploration',
  Write: 'Coding',
  Edit: 'Coding',
  Grep: 'Exploration',
  Glob: 'Exploration',
  TaskUpdate: 'Delegation',
  TaskCreate: 'Delegation',
  Agent: 'Delegation',
  ToolSearch: 'Exploration',
  WebFetch: 'Exploration',
  WebSearch: 'Exploration',
  LS: 'Exploration',
  NotebookEdit: 'Coding',
}

const DEBUG_KEYWORDS = [
  'error', 'fix', 'bug', 'issue', 'traceback', 'exception', 'fail',
  'debug', 'broken', 'crash', 'stack', 'undefined', 'null', 'type error',
  'syntax error', 'runtime', 'segfault', 'panic', 'warn',
]

const FEATURE_KEYWORDS = [
  'add', 'create', 'implement', 'new', 'feature', 'build', 'develop',
  'construct', 'generate', 'setup', 'init', 'introduce',
]

const REFACTOR_KEYWORDS = [
  'refactor', 'rename', 'simplify', 'restructure', 'clean', 'optimize',
  'improve', 'reorganize', 'extract', 'move', 'split', 'consolidate',
  'decompose', 'abstract',
]

const TEST_KEYWORDS = [
  'test', 'pytest', 'jest', 'vitest', 'mocha', 'spec', 'assert',
  'unittest', 'coverage', 'e2e', 'integration', 'mock', 'stub',
]

const PLANNING_KEYWORDS = [
  'plan', 'design', 'architecture', 'strategy', 'approach', 'outline',
  'blueprint', 'roadmap', 'specification', 'requirements', 'proposal',
]

const BRAINSTORM_KEYWORDS = [
  'brainstorm', 'what if', 'idea', 'explore', 'consider', 'options',
  'alternatives', 'possibilities', 'scenarios', 'design', 'concept',
]

const GIT_COMMANDS = [
  'git', 'hub', 'gh',
]

const BUILD_COMMANDS = [
  'npm', 'yarn', 'pnpm', 'bun', 'make', 'cmake', 'docker', 'build',
  'webpack', 'vite', 'rollup', 'esbuild', 'tsc', 'cargo', 'go build',
  'mvn', 'gradle', 'pip', 'poetry', 'pm2', 'systemctl', 'deploy',
]

const TEST_COMMANDS = [
  'test', 'jest', 'vitest', 'pytest', 'mocha', 'rspec', 'go test',
  'cargo test', 'npm test', 'npm run test', 'yarn test', 'pnpm test',
]

function extractKeywordsFromToolInput(toolInput: string | undefined): string[] {
  if (!toolInput) return []

  const keywords: string[] = []

  try {
    const parsed = JSON.parse(toolInput)

    if (typeof parsed === 'string') {
      keywords.push(...parsed.toLowerCase().split(/\s+/))
    } else if (typeof parsed === 'object') {
      const extractFromObj = (obj: any) => {
        for (const value of Object.values(obj)) {
          if (typeof value === 'string') {
            keywords.push(...value.toLowerCase().split(/\s+/))
          } else if (typeof value === 'object' && value !== null) {
            extractFromObj(value)
          }
        }
      }
      extractFromObj(parsed)
    }
  } catch {
    keywords.push(...toolInput.toLowerCase().split(/\s+/))
  }

  return keywords
}

function extractBashCommand(toolInput: string | undefined): string {
  if (!toolInput) return ''

  try {
    const parsed = JSON.parse(toolInput)
    return parsed.command || ''
  } catch {
    return toolInput
  }
}

function classifyByKeywords(keywords: string[]): ActivityCategory | null {
  const keywordSet = new Set(keywords)

  let debugScore = 0
  let featureScore = 0
  let refactorScore = 0
  let testScore = 0
  let planningScore = 0
  let brainstormScore = 0

  for (const kw of keywords) {
    if (DEBUG_KEYWORDS.some((d) => kw.includes(d))) debugScore++
    if (FEATURE_KEYWORDS.some((d) => kw.includes(d))) featureScore++
    if (REFACTOR_KEYWORDS.some((d) => kw.includes(d))) refactorScore++
    if (TEST_KEYWORDS.some((d) => kw.includes(d))) testScore++
    if (PLANNING_KEYWORDS.some((d) => kw.includes(d))) planningScore++
    if (BRAINSTORM_KEYWORDS.some((d) => kw.includes(d))) brainstormScore++
  }

  let bestCategory: ActivityCategory | null = null
  let bestScore = 0

  if (testScore > bestScore) { bestScore = testScore; bestCategory = 'Testing' }
  if (debugScore > bestScore) { bestScore = debugScore; bestCategory = 'Debugging' }
  if (refactorScore > bestScore) { bestScore = refactorScore; bestCategory = 'Refactoring' }
  if (featureScore > bestScore) { bestScore = featureScore; bestCategory = 'Feature Dev' }
  if (planningScore > bestScore) { bestScore = planningScore; bestCategory = 'Planning' }
  if (brainstormScore > bestScore) { bestScore = brainstormScore; bestCategory = 'Brainstorming' }

  if (!bestCategory) return null

  if (bestScore >= 2) return bestCategory

  return bestCategory
}

function classifyByBashCommand(command: string): ActivityCategory | null {
  const cmd = command.toLowerCase().trim()

  if (cmd.startsWith('git') || GIT_COMMANDS.some((g) => cmd.startsWith(g))) {
    return 'Git Ops'
  }

  if (BUILD_COMMANDS.some((b) => cmd.includes(b))) {
    return 'Build/Deploy'
  }

  if (TEST_COMMANDS.some((t) => cmd.includes(t))) {
    return 'Testing'
  }

  return null
}

function classifySessionByToolSequence(sequences: ToolSequence[]): Map<string, ActivityCategory> {
  const sessionActivities = new Map<string, ActivityCategory>()

  for (const seq of sequences) {
    const toolActivity = TOOL_TO_PRIMARY_ACTIVITY[seq.toolName]
    if (!toolActivity) continue

    let activity: ActivityCategory = toolActivity

    if (seq.toolName === 'Bash') {
      const command = extractBashCommand(seq.toolInput)
      const bashClassification = classifyByBashCommand(command)
      if (bashClassification) {
        activity = bashClassification
      }
    } else if (seq.toolName === 'Edit' || seq.toolName === 'Write' || seq.toolName === 'NotebookEdit') {
      const keywords = extractKeywordsFromToolInput(seq.toolInput)
      const keywordClassification = classifyByKeywords(keywords)
      if (keywordClassification) {
        activity = keywordClassification
      }
    } else if (seq.toolName === 'TaskCreate' || seq.toolName === 'TaskUpdate' || seq.toolName === 'Agent') {
      activity = 'Delegation'
    } else if (seq.toolName === 'Read' || seq.toolName === 'Grep' || seq.toolName === 'Glob') {
      const keywords = extractKeywordsFromToolInput(seq.toolInput)
      const keywordClassification = classifyByKeywords(keywords)
      if (keywordClassification) {
        activity = keywordClassification
      }
    }

    sessionActivities.set(seq.timestamp, activity)
  }

  return sessionActivities
}

export function detectEditCycles(sequences: ToolSequence[]): Array<{
  startIndex: number
  endIndex: number
  succeeded: boolean
  tools: string[]
}> {
  const cycles: Array<{ startIndex: number; endIndex: number; succeeded: boolean; tools: string[] }> = []

  let i = 0
  while (i < sequences.length) {
    if (['Edit', 'Write', 'NotebookEdit'].includes(sequences[i].toolName)) {
      let cycleStart = i
      let cycleEnd = i
      let succeeded = true
      const tools = [sequences[i].toolName]

      i++

      while (i < sequences.length) {
        const tool = sequences[i].toolName

        if (['Bash'].includes(tool) && sequences[i].toolInput) {
          const cmd = extractBashCommand(sequences[i].toolInput)
          if (TEST_COMMANDS.some((t) => cmd.includes(t))) {
            tools.push(tool)
            cycleEnd = i
            i++
            continue
          }
        }

        if (['Edit', 'Write', 'NotebookEdit'].includes(tool)) {
          tools.push(tool)
          cycleEnd = i
          succeeded = false
          i++
          continue
        }

        break
      }

      if (cycleEnd > cycleStart) {
        cycles.push({
          startIndex: cycleStart,
          endIndex: cycleEnd,
          succeeded,
          tools,
        })
      }
    } else {
      i++
    }
  }

  return cycles
}

export function classifyTool(toolName: string | undefined, toolInput?: string): ActivityCategory {
  if (!toolName) return 'General'

  const primary = TOOL_TO_PRIMARY_ACTIVITY[toolName]
  if (!primary) return 'General'

  if (toolName === 'Bash' && toolInput) {
    const command = extractBashCommand(toolInput)
    const bashClassification = classifyByBashCommand(command)
    if (bashClassification) return bashClassification
  }

  if (['Edit', 'Write', 'NotebookEdit'].includes(toolName) && toolInput) {
    const keywords = extractKeywordsFromToolInput(toolInput)
    const keywordClassification = classifyByKeywords(keywords)
    if (keywordClassification) return keywordClassification
  }

  return primary
}

export interface ActivityResult {
  name: ActivityCategory
  calls: number
  totalCostUsd: number
  totalTokens: number
  oneShotRate: number
  editCalls: number
  successfulEdits: number
}

export function getActivityStatsWithClassification(db: Database, options: { from: Date; to: Date }): ActivityResult[] {
  const internalDb = db.getDatabase()

  const events = internalDb.prepare(
    `SELECT tool_name, tool_input, cost_usd, total_tokens, timestamp
     FROM token_events WHERE timestamp >= ? AND timestamp <= ? AND tool_name IS NOT NULL`
  ).all(options.from.toISOString(), options.to.toISOString()) as Array<{
    tool_name: string; tool_input: string | null; cost_usd: number; total_tokens: number; timestamp: string
  }>

  const toolToActivity = new Map<string, ActivityCategory>()
  const activityData = new Map<string, {
    calls: number
    cost: number
    tokens: number
    editCalls: number
    successfulEdits: number
    totalEditCycles: number
  }>()

  for (const event of events) {
    const activity = classifyTool(event.tool_name, event.tool_input || undefined)

    const data = activityData.get(activity) || {
      calls: 0,
      cost: 0,
      tokens: 0,
      editCalls: 0,
      successfulEdits: 0,
      totalEditCycles: 0,
    }

    data.calls += 1
    data.cost += event.cost_usd || 0
    data.tokens += event.total_tokens || 0

    if (['Edit', 'Write', 'NotebookEdit'].includes(event.tool_name)) {
      data.editCalls += 1
      data.successfulEdits += 1
    }

    activityData.set(activity, data)
  }

  const sortedEvents = [...events].sort((a, b) => {
    const tsA = new Date(a.timestamp).getTime()
    const tsB = new Date(b.timestamp).getTime()
    return tsA - tsB
  })

  const sequences: ToolSequence[] = sortedEvents.map((e) => ({
    toolName: e.tool_name,
    toolInput: e.tool_input || undefined,
    timestamp: e.timestamp,
    costUsd: e.cost_usd || 0,
    totalTokens: e.total_tokens || 0,
  }))

  const editCycles = detectEditCycles(sequences)

  for (const cycle of editCycles) {
    const firstTool = sequences[cycle.startIndex].toolName
    const activity = classifyTool(firstTool, sequences[cycle.startIndex].toolInput)

    const data = activityData.get(activity)
    if (data) {
      data.totalEditCycles += 1
      if (cycle.succeeded) {
        data.successfulEdits += 0
      } else {
        data.successfulEdits = Math.max(0, data.successfulEdits - 1)
      }
    }
  }

  const results: ActivityResult[] = []

  for (const [name, data] of activityData) {
    const oneShotRate = data.editCalls > 0
      ? Math.round((data.successfulEdits / data.editCalls) * 100) / 100
      : 1

    results.push({
      name: name as ActivityCategory,
      calls: data.calls,
      totalCostUsd: data.cost,
      totalTokens: data.tokens,
      oneShotRate,
      editCalls: data.editCalls,
      successfulEdits: data.successfulEdits,
    })
  }

  return results.sort((a, b) => b.totalCostUsd - a.totalCostUsd)
}

export function classifySessionActivities(
  db: Database,
  sessionId: string
): Array<{ timestamp: string; activity: ActivityCategory; toolName: string }> {
  const internalDb = db.getDatabase()

  const events = internalDb.prepare(
    `SELECT tool_name, tool_input, timestamp FROM token_events WHERE session_id = ? AND tool_name IS NOT NULL ORDER BY timestamp ASC`
  ).all(sessionId) as Array<{
    tool_name: string; tool_input: string | null; timestamp: string
  }>

  const sequences: ToolSequence[] = events.map((e) => ({
    toolName: e.tool_name,
    toolInput: e.tool_input || undefined,
    timestamp: e.timestamp,
    costUsd: 0,
    totalTokens: 0,
  }))

  const classifications = classifySessionByToolSequence(sequences)

  return sequences.map((seq) => ({
    timestamp: seq.timestamp,
    activity: classifications.get(seq.timestamp) || 'General',
    toolName: seq.toolName,
  }))
}
