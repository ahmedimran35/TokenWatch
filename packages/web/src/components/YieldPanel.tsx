interface YieldPanelProps {
  data: {
    totalCostUsd: number
    totalTokens: number
    productive: { sessions: number; costUsd: number; tokens: number; commits: number }
    reverted: { sessions: number; costUsd: number; tokens: number; commits: number }
    abandoned: { sessions: number; costUsd: number; tokens: number }
    sessions: Array<{
      sessionId: string
      projectPath: string
      startTime: string
      endTime: string
      costUsd: number
      tokens: number
      status: 'productive' | 'reverted' | 'abandoned'
      commits: string[]
    }>
  }
}

export function YieldPanel({ data }: YieldPanelProps) {
  if (!data || !data.sessions) return null

  const total = data.sessions.length || 1
  const productivePct = ((data.productive.sessions / total) * 100).toFixed(1)
  const revertedPct = ((data.reverted.sessions / total) * 100).toFixed(1)
  const abandonedPct = ((data.abandoned.sessions / total) * 100).toFixed(1)
  const yieldScore = ((data.productive.costUsd / (data.totalCostUsd || 1)) * 100).toFixed(1)

  const recent = data.sessions.filter((s) => s.status !== 'abandoned').slice(0, 5)

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">YIELD ANALYSIS</h3>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-success/10 border border-success/30 p-2">
          <div className="text-success text-xs">Productive</div>
          <div className="text-xl font-bold text-success">{data.productive.sessions}</div>
          <div className="text-success/70 text-xs">${data.productive.costUsd.toFixed(2)} · {data.productive.commits} commits</div>
        </div>
        <div className="bg-warning/10 border border-warning/30 p-2">
          <div className="text-warning text-xs">Reverted</div>
          <div className="text-xl font-bold text-warning">{data.reverted.sessions}</div>
          <div className="text-warning/70 text-xs">${data.reverted.costUsd.toFixed(2)} · {data.reverted.commits} commits</div>
        </div>
        <div className="bg-error/10 border border-error/30 p-2">
          <div className="text-error text-xs">Abandoned</div>
          <div className="text-xl font-bold text-error">{data.abandoned.sessions}</div>
          <div className="text-error/70 text-xs">${data.abandoned.costUsd.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-3 bg-border/20 rounded overflow-hidden flex">
          <div
            className="h-full bg-success"
            style={{ width: `${productivePct}%` }}
            title={`Productive: ${productivePct}%`}
          />
          <div
            className="h-full bg-warning"
            style={{ width: `${revertedPct}%` }}
            title={`Reverted: ${revertedPct}%`}
          />
          <div
            className="h-full bg-error"
            style={{ width: `${abandonedPct}%` }}
            title={`Abandoned: ${abandonedPct}%`}
          />
        </div>
        <span className="text-xs text-secondary font-mono whitespace-nowrap">{yieldScore}% yield</span>
      </div>

      <div className="flex items-center text-xs mb-2 text-secondary">
        <div className="w-12">STATUS</div>
        <div className="flex-1">PROJECT</div>
        <div className="w-16 text-right">COST</div>
        <div className="w-12 text-right">COMMITS</div>
      </div>
      <div className="border-t border-border/30" />

      {recent.length === 0 && (
        <div className="text-secondary text-xs py-2 text-center">No productive or reverted sessions</div>
      )}

      {recent.map((s, i) => {
        const project = s.projectPath.split('/').pop() || s.projectPath
        const statusColor = s.status === 'productive' ? 'text-success' : 'text-warning'
        const statusLabel = s.status === 'productive' ? '✓' : '✗'
        return (
          <div key={i} className="flex items-center text-xs py-1">
            <div className={`w-12 ${statusColor}`}>{statusLabel}</div>
            <div className="flex-1 text-secondary truncate">{project}</div>
            <div className="w-16 text-right font-mono">${s.costUsd.toFixed(2)}</div>
            <div className="w-12 text-right font-mono">{s.commits.length}</div>
          </div>
        )
      })}
    </div>
  )
}
