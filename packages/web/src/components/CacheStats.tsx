interface CacheStatsProps {
  hitRate?: number
  estimatedSavingsUsd?: number
  dailyHitRates?: Array<{ date: string; hitRate: number }>
}

export function CacheStats({ hitRate = 0, estimatedSavingsUsd = 0 }: CacheStatsProps) {
  const percentage = (hitRate * 100).toFixed(1)

  return (
    <div className="bg-card border border-border p-4">
      <h3 className="text-secondary text-sm mb-4">CACHE</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r="35" stroke="#2a2a2a" strokeWidth="8" fill="none" />
            <circle
              cx="40"
              cy="40"
              r="35"
              stroke="#10b981"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${hitRate * 220} 220`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-lg font-bold">{percentage}%</span>
          </div>
        </div>
        <div>
          <div className="text-secondary text-xs mb-1">Estimated savings</div>
          <div className="font-mono text-xl text-success">${estimatedSavingsUsd.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}