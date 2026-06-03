export interface TokenEvent {
  id: string
  sessionId: string
  projectPath: string
  projectName: string
  timestamp: Date
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costUsd: number
  toolName?: string
  toolInput?: string
  durationMs?: number
  provider: string
  rawMessageId?: string
  bubbleId?: string
  conversationId?: string
  responseId?: string
  cumulativeOutputTokens?: number
}

export interface Session {
  id: string
  projectPath: string
  projectName: string
  provider: string
  startedAt: Date
  endedAt?: Date
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalTokens: number
  totalCostUsd: number
  eventCount: number
  modelsUsed: string[]
  toolsUsed: string[]
}

export interface BurnRate {
  tokensPerMinute: number
  tokensPerHour: number
  tokensPerDay: number
  costPerMinute: number
  costPerHour: number
  costPerDay: number
  windowMinutes: number
  sampledAt: Date
}

export interface DailyStats {
  date: string
  totalTokens: number
  totalCostUsd: number
  sessionCount: number
  topModel: string
  topProject: string
}

export interface ProjectStats {
  projectName: string
  projectPath: string
  totalTokens: number
  totalCostUsd: number
  sessionCount: number
  avgCostPerSession: number
  lastActiveAt: Date
}

export interface ModelStats {
  model: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalCostUsd: number
  callCount: number
  avgCostPerCall: number
}

export interface Alert {
  id: string
  type: 'budget_daily' | 'budget_hourly' | 'burn_rate_spike' | 'session_cost'
  threshold: number
  currentValue: number
  triggeredAt: Date
  acknowledged: boolean
  message: string
}

export interface AlertConfig {
  dailyBudgetUsd?: number
  hourlyBudgetUsd?: number
  burnRateSpikeMultiplier?: number
  sessionBudgetUsd?: number
  slackWebhookUrl?: string
  discordWebhookUrl?: string
  webhookUrl?: string
  emailAddress?: string
}

export interface BudgetUtilization {
  daily: { budget: number; spent: number; remaining: number; percentage: number }
  hourly: { budget: number; spent: number; remaining: number; percentage: number }
  monthly: { budget: number; spent: number; remaining: number; percentage: number }
  currentSession: { budget: number; spent: number; remaining: number; percentage: number } | null
  projectedMonthEnd: number
}

export interface LiveStats {
  burnRate: BurnRate
  todayCost: number
  todayTokens: number
  monthCost: number
  monthTokens: number
  activeSession?: Session
  recentEvents: TokenEvent[]
  alerts: Alert[]
  providers: string[]
}

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