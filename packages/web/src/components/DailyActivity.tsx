interface DailyActivityProps {
  dailyStats: Array<{ date?: string; totalTokens: number; totalCostUsd: number; sessionCount?: number }>
}

export function DailyActivity({ dailyStats }: DailyActivityProps) {
  const data = dailyStats.slice(-7)
  // Add index to data for display purposes
  const dataWithIndices = data.map((item, index) => ({
    ...item,
    displayDate: item.date ? item.date.slice(5) : `Day ${index + 1}`
  }))

  const maxCost = Math.max(...data.map((d) => d.totalCostUsd), 0.001)

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">DAILY ACTIVITY</h3>
      <div className="space-y-2">
        <div className="flex items-center text-xs">
          <div className="w-12 text-center text-secondary font-mono">DATE</div>
          <div className="flex-1 text-center text-secondary">BAR</div>
          <div className="w-16 text-right text-accent font-mono">COST</div>
          <div className="w-8 text-right text-secondary font-mono">CALLS</div>
        </div>
        <div className="border-t border-border/30" />
        {dataWithIndices.map((d, index) => {
          const pct = Math.max((d.totalCostUsd / maxCost) * 100, 2)
          return (
            <div key={index} className="flex items-center text-xs">
              <div className="w-12 text-center text-secondary font-mono">{d.displayDate}</div>
              <div className="flex-1 h-3 bg-border/20 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct}%`,
                    background: pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#3b82f6',
                  }}
                />
              </div>
              <div className="w-16 text-right text-accent font-mono">${d.totalCostUsd.toFixed(4)}</div>
              <div className="w-8 text-right text-secondary font-mono">{d.sessionCount || 0}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
