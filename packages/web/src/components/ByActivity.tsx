interface ActivityStat {
  name: string
  calls: number
  totalCostUsd: number
  totalTokens: number
  oneShotRate?: number
}

interface ByActivityProps {
  activities: ActivityStat[]
}

const ACTIVITY_COLORS: Record<string, string> = {
  Coding: '#ef4444',
  Exploration: '#f59e0b',
  Debugging: '#10b981',
  'Feature Dev': '#3b82f6',
  Delegation: '#8b5cf6',
  Conversation: '#ec4899',
  Testing: '#06b6d4',
  Brainstorming: '#f97316',
  Refactoring: '#84cc16',
  'Build/Deploy': '#14b8a6',
  General: '#6b7280',
  'Git Ops': '#6366f1',
  Planning: '#a855f7',
}

export function ByActivity({ activities }: ByActivityProps) {
  const maxCost = Math.max(...activities.map((a) => a.totalCostUsd), 0.001)

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">BY ACTIVITY</h3>
      <div className="flex items-center text-xs mb-2">
        <div className="flex-1 text-center text-secondary">ACTIVITY</div>
        <div className="w-20 text-right text-accent font-mono">COST</div>
        <div className="w-10 text-right text-secondary font-mono">TURNS</div>
        <div className="w-12 text-right text-secondary font-mono">1-SHOT</div>
      </div>
      <div className="border-t border-border/30 mb-2" />
      <div className="space-y-1">
        {activities.map((a) => (
          <div key={a.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-sm inline-block mr-2"
              style={{ backgroundColor: ACTIVITY_COLORS[a.name] || '#6b7280' }}
            />
            <span className="w-24 truncate" style={{ color: ACTIVITY_COLORS[a.name] || '#9ca3af' }}>
              {a.name}
            </span>
            <div className="flex-1 h-2 bg-border/20 rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max((a.totalCostUsd / maxCost) * 100, 2)}%`,
                  backgroundColor: ACTIVITY_COLORS[a.name] || '#6b7280',
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-accent font-mono w-16 text-right">${a.totalCostUsd.toFixed(2)}</span>
            <span className="text-secondary font-mono w-10 text-right">{a.calls}</span>
            <span className="font-mono w-12 text-right" style={{
              color: a.oneShotRate !== undefined
                ? a.oneShotRate >= 0.8 ? '#10b981' : a.oneShotRate >= 0.5 ? '#f59e0b' : '#ef4444'
                : '#6b7280'
            }}>
              {a.oneShotRate !== undefined ? `${Math.round(a.oneShotRate * 100)}%` : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
