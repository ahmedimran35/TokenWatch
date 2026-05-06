import { format } from 'date-fns'
import type { Session } from '@tokenwatch/types'

interface SessionTableProps {
  sessions: Session[]
  onSelect?: (session: Session) => void
}

export function SessionTable({ sessions, onSelect }: SessionTableProps) {
  const formatCost = (cost: number) => `$${cost.toFixed(4)}`
  const formatTokens = (t: number) => {
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`
    if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K`
    return t.toString()
  }

  return (
    <div className="bg-card border border-border p-4 overflow-auto">
      <h3 className="text-secondary text-sm mb-4">TOP SESSIONS</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-secondary text-left border-b border-border">
            <th className="pb-2 font-medium">Project</th>
            <th className="pb-2 font-medium">Started</th>
            <th className="pb-2 font-medium">Tokens</th>
            <th className="pb-2 font-medium">Cost</th>
            <th className="pb-2 font-medium">Models</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.id}
              className="border-b border-border/50 hover:bg-border/30 cursor-pointer"
              onClick={() => onSelect?.(session)}
            >
              <td className="py-2 font-mono text-xs">{session.projectName}</td>
              <td className="py-2 text-secondary text-xs">
                {format(new Date(session.startedAt), 'MMM d, HH:mm')}
              </td>
              <td className="py-2 font-mono text-xs">{formatTokens(session.totalTokens)}</td>
              <td className="py-2 font-mono text-accent text-xs">{formatCost(session.totalCostUsd)}</td>
              <td className="py-2 text-secondary text-xs">{session.modelsUsed[0]?.slice(0, 20) || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}