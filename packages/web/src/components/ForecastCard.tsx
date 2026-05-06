interface ForecastProps {
  forecast?: {
    projectedMonthEndCost: number
    projectedMonthEndTokens: number
    dailyAverageCost: number
    dailyAverageTokens: number
    trend: 'increasing' | 'stable' | 'decreasing'
    daysRemaining: number
    confidence: 'low' | 'medium' | 'high'
  }
}

const TREND_COLORS = {
  increasing: '#ef4444',
  stable: '#10b981',
  decreasing: '#3b82f6',
}

const TREND_ICONS = {
  increasing: '↑',
  stable: '→',
  decreasing: '↓',
}

export function ForecastCard({ forecast }: ForecastProps) {
  if (!forecast) return null

  const trendColor = TREND_COLORS[forecast.trend]
  const trendIcon = TREND_ICONS[forecast.trend]
  const confidenceColor =
    forecast.confidence === 'high'
      ? 'text-success'
      : forecast.confidence === 'medium'
        ? 'text-[#f59e0b]'
        : 'text-secondary'

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">MONTH FORECAST</h3>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-secondary">{forecast.daysRemaining} days remaining</span>
        <span className={`text-xs ${confidenceColor}`}>
          {forecast.confidence} confidence
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Projected cost</span>
          <span className="font-bold text-accent" style={{ color: trendColor }}>
            ${forecast.projectedMonthEndCost.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Daily average</span>
          <span className="font-mono text-secondary">
            ${forecast.dailyAverageCost.toFixed(2)}/day
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Projected tokens</span>
          <span className="font-mono text-secondary">
            {formatNumber(forecast.projectedMonthEndTokens)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
          <span className="text-secondary">Trend</span>
          <span className="font-mono" style={{ color: trendColor }}>
            {trendIcon} {forecast.trend}
          </span>
        </div>
      </div>
    </div>
  )
}
