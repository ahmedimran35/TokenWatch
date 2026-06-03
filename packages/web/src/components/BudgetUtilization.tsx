import type { BudgetUtilization } from '@tokenwatch/types'

interface BudgetBarProps {
  label: string
  budget: number
  spent: number
  remaining: number
  percentage: number
}

function BudgetBar({ label, budget, spent, remaining, percentage }: BudgetBarProps) {
  const color = percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : percentage >= 50 ? 'bg-blue-500' : 'bg-green-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-secondary">{label}</span>
        <span className="text-secondary">${spent.toFixed(budget > 1 ? 2 : 4)} / ${budget.toFixed(budget > 1 ? 2 : 4)}</span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span className={percentage >= 100 ? 'text-red-400' : 'text-secondary'}>{percentage.toFixed(1)}% used</span>
        <span className="text-secondary">${remaining.toFixed(2)} remaining</span>
      </div>
    </div>
  )
}

interface BudgetUtilizationProps {
  data?: BudgetUtilization
}

export function BudgetUtilization({ data }: BudgetUtilizationProps) {
  if (!data) return null

  return (
    <div className="border border-border p-3">
      <h3 className="text-sm font-bold mb-3">BUDGET UTILIZATION</h3>
      <div className="space-y-4">
        {data.daily.budget > 0 && <BudgetBar label="Daily" {...data.daily} />}
        {data.hourly.budget > 0 && <BudgetBar label="Hourly" {...data.hourly} />}
        {data.monthly.budget > 0 && <BudgetBar label="Monthly" {...data.monthly} />}
        {data.currentSession && data.currentSession.budget > 0 && (
          <BudgetBar label="Current Session" {...data.currentSession} />
        )}
        {data.projectedMonthEnd > 0 && (
          <div className="text-xs text-secondary pt-2 border-t border-border">
            Projected month-end: <span className="text-[#f59e0b]">${data.projectedMonthEnd.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
