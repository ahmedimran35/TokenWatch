interface ShellCommandStat {
  command: string
  calls: number
  totalCostUsd: number
}

interface ShellCommandsProps {
  commands: ShellCommandStat[]
}

const CMD_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6']

export function ShellCommands({ commands }: ShellCommandsProps) {
  const maxCalls = Math.max(...commands.map((c) => c.calls), 1)

  return (
    <div className="border border-border/50 p-3">
      <h3 className="text-secondary text-xs font-semibold mb-3">SHELL COMMANDS</h3>
      <div className="flex items-center text-xs mb-2">
        <div className="flex-1 text-center text-secondary">COMMAND</div>
        <div className="w-10 text-right text-secondary font-mono">CALLS</div>
      </div>
      <div className="border-t border-border/30" />
      <div className="space-y-1">
        {commands.slice(0, 10).map((c, i) => (
          <div key={c.command} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-sm inline-block mr-2"
              style={{ backgroundColor: CMD_COLORS[i % CMD_COLORS.length] }}
            />
            <span className="w-20 truncate font-mono text-secondary">{c.command}</span>
            <div className="flex-1 h-2 bg-border/20 rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${Math.max((c.calls / maxCalls) * 100, 2)}%`,
                  backgroundColor: CMD_COLORS[i % CMD_COLORS.length],
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-secondary font-mono w-10 text-right">{c.calls}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
