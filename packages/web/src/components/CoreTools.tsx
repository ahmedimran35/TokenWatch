interface ToolStat {
  name: string
  calls: number
  totalCostUsd: number
  totalTokens: number
}

interface CoreToolsProps {
  tools: ToolStat[]
}

const TOOL_COLORS: Record<string, string> = {
  Bash: '#ef4444',
  Read: '#f59e0b',
  Edit: '#10b981',
  Grep: '#3b82f6',
  Write: '#8b5cf6',
  Glob: '#ec4899',
  LS: '#06b6d4',
  TaskUpdate: '#f97316',
  TaskCreate: '#84cc16',
  Agent: '#14b8a6',
  ToolSearch: '#6366f1',
  WebFetch: '#a855f7',
  WebSearch: '#6b7280',
}

export function CoreTools({ tools }: CoreToolsProps) {
  const maxCalls = Math.max(...tools.map((t) => t.calls), 1)

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">CORE TOOLS</h3>
      <div className="flex items-center text-xs mb-2">
        <div className="flex-1 text-center text-secondary">TOOL</div>
        <div className="w-12 text-right text-secondary font-mono">CALLS</div>
      </div>
      <div className="border-t border-border/30" />
      <div className="space-y-1">
        {tools.slice(0, 12).map((t) => (
          <div key={t.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-sm inline-block mr-2"
              style={{ backgroundColor: TOOL_COLORS[t.name] || '#6b7280' }}
            />
            <span className="w-24 truncate text-secondary">{t.name}</span>
            <div className="flex-1 h-2 bg-border/20 rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max((t.calls / maxCalls) * 100, 2)}%`,
                  backgroundColor: TOOL_COLORS[t.name] || '#6b7280',
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-secondary font-mono w-12 text-right">{t.calls}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
