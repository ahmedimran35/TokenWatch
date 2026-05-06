import { Database } from './database'

export interface CostForecast {
  projectedMonthEndCost: number
  projectedMonthEndTokens: number
  dailyAverageCost: number
  dailyAverageTokens: number
  trend: 'increasing' | 'stable' | 'decreasing'
  daysRemaining: number
  confidence: 'low' | 'medium' | 'high'
  dailyBreakdown: Array<{
    date: string
    actualCost?: number
    projectedCost: number
    actualTokens?: number
    projectedTokens: number
  }>
}

export function calculateForecast(db: Database): CostForecast {
  const internalDb = db.getDatabase()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const daysInMonth = monthEnd.getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed

  // Get daily breakdown for current month
  const dailyRows = internalDb
    .prepare(
      `SELECT
        date(timestamp) as date,
        SUM(total_tokens) as tokens,
        SUM(cost_usd) as cost
       FROM token_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY date(timestamp)
       ORDER BY date`
    )
    .all(monthStart.toISOString(), now.toISOString()) as Array<{
      date: string
      tokens: number
      cost: number
    }>

  // Current month totals
  const currentMonthTotal = dailyRows.reduce((sum, d) => sum + d.cost, 0)
  const currentMonthTokens = dailyRows.reduce((sum, d) => sum + d.tokens, 0)

  // Daily averages
  const dailyAvgCost = daysElapsed > 0 ? currentMonthTotal / daysElapsed : 0
  const dailyAvgTokens = daysElapsed > 0 ? currentMonthTokens / daysElapsed : 0

  // Calculate trend using recent vs older data
  const midPoint = Math.floor(daysElapsed / 2)
  const recentDays = dailyRows.slice(-midPoint)
  const olderDays = dailyRows.slice(0, midPoint)

  const recentAvg = recentDays.length > 0
    ? recentDays.reduce((sum, d) => sum + d.cost, 0) / recentDays.length
    : 0
  const olderAvg = olderDays.length > 0
    ? olderDays.reduce((sum, d) => sum + d.cost, 0) / olderDays.length
    : 0

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
  if (olderAvg > 0) {
    const changeRatio = (recentAvg - olderAvg) / olderAvg
    if (changeRatio > 0.15) trend = 'increasing'
    else if (changeRatio < -0.15) trend = 'decreasing'
  }

  // Adjust projection based on trend
  let projectedDailyCost = dailyAvgCost
  if (trend === 'increasing') projectedDailyCost *= 1.15
  else if (trend === 'decreasing') projectedDailyCost *= 0.85

  const projectedMonthEndCost = currentMonthTotal + (projectedDailyCost * daysRemaining)
  const projectedMonthEndTokens = currentMonthTokens + (dailyAvgTokens * daysRemaining)

  // Confidence based on data points
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (dailyRows.length >= 14) confidence = 'high'
  else if (dailyRows.length >= 5) confidence = 'medium'

  // Build daily breakdown for visualization
  const dailyBreakdown: CostForecast['dailyBreakdown'] = []

  // Actual days
  for (const row of dailyRows) {
    dailyBreakdown.push({
      date: row.date,
      actualCost: row.cost,
      projectedCost: row.cost,
      actualTokens: row.tokens,
      projectedTokens: row.tokens,
    })
  }

  // Projected future days
  for (let i = 1; i <= daysRemaining; i++) {
    const futureDate = new Date(now)
    futureDate.setDate(now.getDate() + i)
    const dateStr = futureDate.toISOString().split('T')[0]

    dailyBreakdown.push({
      date: dateStr,
      projectedCost: projectedDailyCost,
      projectedTokens: dailyAvgTokens,
    })
  }

  return {
    projectedMonthEndCost: Math.round(projectedMonthEndCost * 100) / 100,
    projectedMonthEndTokens: Math.round(projectedMonthEndTokens),
    dailyAverageCost: Math.round(dailyAvgCost * 100) / 100,
    dailyAverageTokens: Math.round(dailyAvgTokens),
    trend,
    daysRemaining,
    confidence,
    dailyBreakdown,
  }
}
