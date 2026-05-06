import { useSessionHealthScores } from '../hooks/useHealth'

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function SessionHealthPanel({ from, to }: { from: Date; to: Date }) {
  const { data: scores, isLoading } = useSessionHealthScores(from, to)

  if (isLoading || !scores) return <div className="animate-pulse h-40 bg-gray-800 rounded" />

  const healthy = scores.filter((s: any) => s.status === 'healthy').length
  const average = scores.filter((s: any) => s.status === 'average').length
  const poor = scores.filter((s: any) => s.status === 'poor').length
  const stuck = scores.filter((s: any) => s.status === 'stuck').length
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: any) => a + b.score, 0) / scores.length) : 0

  return (
    <div className="border border-purple-500/30 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-purple-400 font-semibold text-xs uppercase tracking-wider">Session Health</h3>
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${scoreColor(avgScore)}`} style={{ width: `${avgScore}%` }} />
          </div>
          <span className="text-xs text-gray-400 font-mono">{avgScore}/100</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
        <div className="bg-green-900/30 rounded py-1">
          <div className="text-green-400 font-bold text-lg">{healthy}</div>
          <div className="text-gray-500">Healthy</div>
        </div>
        <div className="bg-yellow-900/30 rounded py-1">
          <div className="text-yellow-400 font-bold text-lg">{average}</div>
          <div className="text-gray-500">Average</div>
        </div>
        <div className="bg-orange-900/30 rounded py-1">
          <div className="text-orange-400 font-bold text-lg">{poor}</div>
          <div className="text-gray-500">Poor</div>
        </div>
        <div className="bg-red-900/30 rounded py-1">
          <div className="text-red-400 font-bold text-lg">{stuck}</div>
          <div className="text-gray-500">Stuck</div>
        </div>
      </div>

      {/* Sessions with issues */}
      {(poor + stuck) > 0 && (
        <div>
          <div className="text-gray-500 text-xs mb-1">Sessions needing attention:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {scores
              .filter((s: any) => s.status === 'poor' || s.status === 'stuck')
              .slice(0, 5)
              .map((s: any) => (
                <div key={s.sessionId} className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${scoreColor(s.score)}`} />
                    <span className="text-gray-300 truncate max-w-[100px]">{s.projectName}</span>
                    <span className="text-gray-500">{(s.outputInputRatio * 100).toFixed(1)}% out</span>
                  </div>
                  <span className="text-gray-400 font-mono">{formatCost(s.totalCostUsd)}</span>
                </div>
              ))}
          </div>
          {scores
            .filter((s: any) => s.flags && s.flags.length > 0)
            .slice(0, 5)
            .map((s: any) => (
              s.flags.map((flag: string, i: number) => (
                <div key={`${s.sessionId}-${i}`} className="text-xs text-orange-300 mt-0.5 italic truncate">{flag}</div>
              ))
            ))}
        </div>
      )}
    </div>
  )
}
