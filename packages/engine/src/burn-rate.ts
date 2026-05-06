import { Database } from './database'
import type { BurnRate } from '@tokenwatch/types'

export function calculateBurnRate(db: Database, windowMinutes: number = 5): BurnRate {
  if (windowMinutes <= 0) windowMinutes = 5

  const internalDb = db.getDatabase()
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const row = internalDb
    .prepare(
      `SELECT COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost_usd), 0) as total_cost
       FROM token_events WHERE timestamp >= ?`
    )
    .get(since) as any

  const totalTokens = row?.total_tokens ?? 0
  const totalCost = row?.total_cost ?? 0

  if (totalTokens === 0) {
    return {
      tokensPerMinute: 0,
      tokensPerHour: 0,
      tokensPerDay: 0,
      costPerMinute: 0,
      costPerHour: 0,
      costPerDay: 0,
      windowMinutes,
      sampledAt: new Date(),
    }
  }

  const tokensPerMinute = totalTokens / windowMinutes
  const costPerMinute = totalCost / windowMinutes

  return {
    tokensPerMinute: Math.round(tokensPerMinute),
    tokensPerHour: Math.round(tokensPerMinute * 60),
    tokensPerDay: Math.round(tokensPerMinute * 60 * 24),
    costPerMinute: costPerMinute,
    costPerHour: costPerMinute * 60,
    costPerDay: costPerMinute * 60 * 24,
    windowMinutes,
    sampledAt: new Date(),
  }
}

export function getBurnRateHistory(
  db: Database,
  periodHours: number,
  bucketMinutes: number
): Array<{ bucketStart: Date; tokensPerMinute: number; costPerMinute: number }> {
  const internalDb = db.getDatabase()
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString()

  // SQLite doesn't have a great date bucketing function, so we'll do it in JS
  const rows = internalDb
    .prepare(
      `SELECT timestamp, total_tokens, cost_usd
       FROM token_events WHERE timestamp >= ? ORDER BY timestamp`
    )
    .all(since) as Array<{ timestamp: string; total_tokens: number; cost_usd: number }>

  const buckets = new Map<number, { tokens: number; cost: number; count: number }>()
  const bucketMs = bucketMinutes * 60 * 1000

  for (const row of rows) {
    const ts = new Date(row.timestamp).getTime()
    const bucketStart = Math.floor(ts / bucketMs) * bucketMs
    const existing = buckets.get(bucketStart)
    if (existing) {
      existing.tokens += row.total_tokens
      existing.cost += row.cost_usd
      existing.count += 1
    } else {
      buckets.set(bucketStart, { tokens: row.total_tokens, cost: row.cost_usd, count: 1 })
    }
  }

  const result: Array<{ bucketStart: Date; tokensPerMinute: number; costPerMinute: number }> = []
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b)
  for (const key of sortedKeys) {
    const bucket = buckets.get(key)!
    result.push({
      bucketStart: new Date(key),
      tokensPerMinute: bucket.tokens / bucketMinutes,
      costPerMinute: bucket.cost / bucketMinutes,
    })
  }

  return result
}
