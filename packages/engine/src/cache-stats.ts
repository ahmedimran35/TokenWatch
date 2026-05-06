import { Database } from './database'

export interface CacheStatsResult {
  hitRate: number
  totalCacheReads: number
  totalCacheWrites: number
  estimatedSavingsUsd: number
  dailyHitRates: Array<{ date: string; hitRate: number }>
}

export function getCacheStats(
  db: Database,
  options: { from: Date; to: Date }
): CacheStatsResult {
  const internalDb = db.getDatabase()

  const row = internalDb
    .prepare(
      `SELECT
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(cache_read_tokens), 0) as total_cache_read,
        COALESCE(SUM(cache_write_tokens), 0) as total_cache_write
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?`
    )
    .get(options.from.toISOString(), options.to.toISOString()) as any

  const totalInput = row?.total_input ?? 0
  const totalCacheRead = row?.total_cache_read ?? 0
  const totalCacheWrite = row?.total_cache_write ?? 0

  const hitRate = totalInput + totalCacheRead > 0 ? totalCacheRead / (totalInput + totalCacheRead) : 0

  // Estimate savings: average input cost per million tokens across all models
  const avgPriceRow = internalDb
    .prepare(
      `SELECT AVG(cost_usd * 1000000 / NULLIF(input_tokens, 0)) as avg_input_price
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ? AND input_tokens > 0`
    )
    .get(options.from.toISOString(), options.to.toISOString()) as any
  const avgInputPrice = avgPriceRow?.avg_input_price ?? 3
  const estimatedSavingsUsd = (totalCacheRead * avgInputPrice) / 1_000_000

  const dailyRows = internalDb
    .prepare(
      `SELECT
        date(timestamp) as date,
        SUM(input_tokens) as total_input,
        SUM(cache_read_tokens) as total_cache_read
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY date(timestamp)
       ORDER BY date`
    )
    .all(options.from.toISOString(), options.to.toISOString()) as Array<{
    date: string
    total_input: number
    total_cache_read: number
  }>

  const dailyHitRates = dailyRows.map((r) => ({
    date: r.date,
    hitRate: r.total_input + r.total_cache_read > 0 ? r.total_cache_read / (r.total_input + r.total_cache_read) : 0,
  }))

  return {
    hitRate,
    totalCacheReads: totalCacheRead,
    totalCacheWrites: totalCacheWrite,
    estimatedSavingsUsd,
    dailyHitRates,
  }
}
