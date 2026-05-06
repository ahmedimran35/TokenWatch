import { useContextWaste } from '../hooks/useHealth'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`
}

export function ContextWastePanel({ from, to }: { from: Date; to: Date }) {
  const { data: waste, isLoading } = useContextWaste(from, to)

  if (isLoading || !waste) return <div className="animate-pulse h-40 bg-gray-800 rounded" />

  const wastePct = Math.round(waste.wastePercentage || 0)

  return (
    <div className="border border-orange-500/30 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-orange-400 font-semibold text-xs uppercase tracking-wider">Context Waste Analysis</h3>
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${
          wastePct > 70 ? 'bg-red-900/50 text-red-400' :
          wastePct > 50 ? 'bg-orange-900/50 text-orange-400' :
          'bg-green-900/50 text-green-400'
        }`}>{wastePct}% waste</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
        <div>
          <div className="text-gray-500">Total Input</div>
          <div className="text-white font-mono">{formatTokens(waste.totalInputTokens || 0)}</div>
        </div>
        <div>
          <div className="text-gray-500">Total Output</div>
          <div className="text-white font-mono">{formatTokens(waste.totalOutputTokens || 0)}</div>
        </div>
        <div>
          <div className="text-gray-500">Wasted Cost</div>
          <div className="text-red-400 font-mono">{formatCost(waste.totalWastedCostUsd || 0)}</div>
        </div>
      </div>

      {/* Waste bar */}
      <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500"
          style={{ width: `${Math.min(wastePct, 100)}%` }}
        />
      </div>

      {/* Top wasteful sessions */}
      {waste.sessionsWithHighWaste && waste.sessionsWithHighWaste.length > 0 && (
        <div>
          <div className="text-gray-500 text-xs mb-1">Most wasteful sessions:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {waste.sessionsWithHighWaste.slice(0, 5).map((s: any, i: number) => (
              <div key={s.sessionId} className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">#{i + 1}</span>
                  <span className="text-gray-300 truncate max-w-[120px]">{s.projectName}</span>
                  <span className="text-gray-500">{formatTokens(s.wastedTokens)} tokens</span>
                </div>
                <span className="text-red-400 font-mono">{formatCost(s.wastedCostUsd)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
