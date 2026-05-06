interface OptimizeFinding {
  id: string
  type: string
  title: string
  description: string
  estimatedTokensWasted: number
  estimatedCostUsd: number
  fix: string
  severity: 'critical' | 'warning' | 'info'
  status: 'new' | 'improving' | 'resolved'
  category: string
}

interface OptimizeResult {
  findings: OptimizeFinding[]
  totalWastedTokens: number
  totalWastedCostUsd: number
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
}

interface OptimizePanelProps {
  result: OptimizeResult
}

const SEVERITY_COLORS = {
  critical: 'border-red-500/50 bg-red-500/5',
  warning: 'border-yellow-500/50 bg-yellow-500/5',
  info: 'border-blue-500/50 bg-blue-500/5',
}

const SEVERITY_BADGE_COLORS = {
  critical: 'bg-red-500/20 text-red-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  info: 'bg-blue-500/20 text-blue-400',
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-success',
  B: 'text-[#10b981]',
  C: 'text-[#f59e0b]',
  D: 'text-[#f97316]',
  F: 'text-red-500',
}

export function OptimizePanel({ result }: OptimizePanelProps) {
  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className="border border-border/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-secondary text-xs font-semibold">OPTIMIZE</h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${GRADE_COLORS[result.healthGrade] || 'text-secondary'}`}>
            {result.healthGrade}
          </span>
          <span className="text-xs text-secondary">{result.summary}</span>
        </div>
      </div>

      {result.findings.length > 0 && (
        <div className="flex items-center gap-4 mb-3 text-xs">
          <span className="text-accent">
            {formatNumber(result.totalWastedTokens)} tokens wasted
          </span>
          <span className="text-red-400">
            ${result.totalWastedCostUsd.toFixed(4)}
          </span>
          <span className="text-secondary">
            {result.findings.length} findings
          </span>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {result.findings.map((finding) => (
          <div
            key={finding.id}
            className={`border rounded p-2 ${SEVERITY_COLORS[finding.severity]}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${SEVERITY_BADGE_COLORS[finding.severity]}`}>
                  {finding.severity.toUpperCase()}
                </span>
                <span className="text-xs text-secondary">{finding.category}</span>
              </div>
              <span className="text-accent font-mono text-xs">
                ${finding.estimatedCostUsd.toFixed(4)}
              </span>
            </div>

            <div className="text-xs font-medium mb-1">{finding.title}</div>
            <div className="text-xs text-secondary mb-2">{finding.description}</div>

            <div className="text-[10px] text-secondary bg-border/20 rounded p-2 font-mono whitespace-pre-wrap">
              {finding.fix}
            </div>
          </div>
        ))}

        {result.findings.length === 0 && (
          <div className="text-center text-secondary text-xs py-4">
            No optimization issues found. Your setup looks good!
          </div>
        )}
      </div>
    </div>
  )
}
