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
  webhookUrl?: string
  emailAddress?: string
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