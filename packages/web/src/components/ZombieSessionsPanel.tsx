import { useZombieSessions } from '../hooks/useHealth'

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function ZombieSessionsPanel() {
  const { data: zombies, isLoading } = useZombieSessions(30)

  if (isLoading || !zombies || zombies.length === 0) return null

  const statusColors: Record<string, string> = {
    'idle': 'bg-yellow-900/50 text-yellow-400',
    'likely-loop': 'bg-red-900/50 text-red-400',
    'context-refresh-spam': 'bg-orange-900/50 text-orange-400',
  }

  return (
    <div className="border border-yellow-500/30 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-yellow-400 font-semibold text-xs uppercase tracking-wider">Zombie Sessions ({zombies.length})</h3>
        <span className="text-xs text-gray-500">Idle &gt;30min</span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {zombies.map((z: any) => (
          <div key={z.sessionId} className="bg-gray-800/50 rounded px-2 py-2 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${statusColors[z.status] || 'bg-gray-700 text-gray-400'}`}>
                  {z.status}
                </span>
                <span className="text-gray-300 truncate">{z.projectName}</span>
              </div>
              <span className="text-yellow-400 font-mono">{formatCost(z.costDuringIdle)}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <span>Idle: {z.idleMinutes}m</span>
              <span>Burned: {formatTokens(z.tokensDuringIdle)} tokens</span>
            </div>
            <div className="text-orange-300 mt-1 italic">{z.recommendation}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
