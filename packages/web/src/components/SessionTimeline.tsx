import { useMemo } from 'react'

interface TimelineEvent {
  id: string
  timestamp: string
  model: string
  totalTokens: number
  costUsd: number
  toolName?: string
  durationMs?: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}

interface SessionTimelineProps {
  events: TimelineEvent[]
  session?: {
    projectName: string
    provider: string
    startedAt: string
    totalCostUsd: number
    totalTokens: number
    eventCount: number
  }
  onClose?: () => void
}

const TOOL_COLORS: Record<string, string> = {
  Read: '#10b981',
  Write: '#3b82f6',
  Bash: '#f59e0b',
  Grep: '#8b5cf6',
  Glob: '#ec4899',
  Edit: '#06b6d4',
  NotebookEdit: '#f97316',
}

function getToolColor(toolName?: string): string {
  if (!toolName) return '#6b7280'
  for (const [key, color] of Object.entries(TOOL_COLORS)) {
    if (toolName.toLowerCase().includes(key.toLowerCase())) return color
  }
  return '#6b7280'
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function SessionTimeline({ events, session, onClose }: SessionTimelineProps) {
  const timeline = useMemo(() => {
    if (events.length === 0) return []

    const startTime = new Date(events[0].timestamp).getTime()
    const endTime = new Date(events[events.length - 1].timestamp).getTime()
    const totalDuration = endTime - startTime || 1

    return events.map((e) => ({
      ...e,
      offset: ((new Date(e.timestamp).getTime() - startTime) / totalDuration) * 100,
      toolColor: getToolColor(e.toolName),
    }))
  }, [events])

  const maxCost = Math.max(...events.map((e) => e.costUsd), 0.001)
  const maxTokens = Math.max(...events.map((e) => e.totalTokens), 1)

  const usedTools = useMemo(() => {
    const tools = new Set<string>()
    events.forEach((e) => e.toolName && tools.add(e.toolName))
    return Array.from(tools)
  }, [events])

  return (
    <div className="border border-border/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-secondary text-xs font-semibold">SESSION TIMELINE</h3>
        {onClose && (
          <button onClick={onClose} className="text-secondary hover:text-primary text-xs px-2 py-1">
            ✕
          </button>
        )}
      </div>

      {session && (
        <div className="flex items-center gap-4 mb-3 text-xs">
          <span className="text-accent">{session.projectName}</span>
          <span className="text-secondary">{session.provider}</span>
          <span className="text-accent">${session.totalCostUsd.toFixed(4)}</span>
          <span className="text-secondary">{session.totalTokens.toLocaleString()} tokens</span>
          <span className="text-secondary">{session.eventCount} events</span>
        </div>
      )}

      {/* Tool legend */}
      {usedTools.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs">
          {usedTools.map((tool) => (
            <div key={tool} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: getToolColor(tool) }}
              />
              <span className="text-secondary">{tool}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="relative h-20 bg-border/10 rounded mb-2 overflow-hidden">
        {/* Time markers */}
        <div className="absolute inset-x-0 top-0 flex justify-between px-1 text-[10px] text-secondary/50">
          {events.length > 0 && (
            <>
              <span>{formatTime(events[0].timestamp)}</span>
              <span>{formatTime(events[events.length - 1].timestamp)}</span>
            </>
          )}
        </div>

        {/* Event bars */}
        <div className="absolute inset-0 pt-4 pb-1">
          {timeline.map((e) => (
            <div
              key={e.id}
              className="absolute top-0 h-full group"
              style={{
                left: `${e.offset}%`,
                width: `${Math.max(100 / timeline.length, 0.5)}%`,
              }}
            >
              <div
                className="h-full rounded-sm transition-opacity group-hover:opacity-100 cursor-pointer"
                style={{
                  backgroundColor: e.toolColor,
                  opacity: 0.4 + (e.costUsd / maxCost) * 0.6,
                  height: `${Math.max((e.totalTokens / maxTokens) * 100, 10)}%`,
                  marginTop: `${100 - (e.totalTokens / maxTokens) * 100}%`,
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-card border border-border px-2 py-1 rounded text-[10px] whitespace-nowrap z-10">
                <div className="font-mono">{formatTime(e.timestamp)}</div>
                <div>{e.toolName || 'call'}</div>
                <div className="text-accent">${e.costUsd.toFixed(4)}</div>
                <div className="text-secondary">{e.totalTokens.toLocaleString()} tokens</div>
                {e.durationMs && (
                  <div className="text-secondary">{formatDuration(e.durationMs)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        <div className="flex items-center text-xs mb-1 text-secondary">
          <div className="w-16">TIME</div>
          <div className="w-20">TOOL</div>
          <div className="w-16 text-right">TOKENS</div>
          <div className="w-16 text-right">COST</div>
          <div className="w-12 text-right">DUR</div>
        </div>
        <div className="border-t border-border/30" />
        {[...events].reverse().slice(0, 50).map((e) => (
          <div key={e.id} className="flex items-center text-xs hover:bg-border/10 px-1 rounded">
            <div className="w-16 font-mono text-secondary">{formatTime(e.timestamp)}</div>
            <div className="w-20 flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ backgroundColor: getToolColor(e.toolName) }}
              />
              <span className="truncate text-secondary">{e.toolName || '-'}</span>
            </div>
            <div className="w-16 text-right font-mono text-secondary">
              {e.totalTokens.toLocaleString()}
            </div>
            <div className="w-16 text-right font-mono text-accent">
              ${e.costUsd.toFixed(4)}
            </div>
            <div className="w-12 text-right font-mono text-secondary">
              {formatDuration(e.durationMs)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
