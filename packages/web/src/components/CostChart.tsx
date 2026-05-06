import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DailyStats } from '@tokenwatch/types'

interface CostChartProps {
  dailyStats: DailyStats[]
  period?: '7d' | '30d' | 'month' | 'all'
}

export function CostChart({ dailyStats, period = '7d' }: CostChartProps) {
  const avgCost = dailyStats.length > 0 ? dailyStats.reduce((a, b) => a + b.totalCostUsd, 0) / dailyStats.length : 0

  const displayData = period === '7d' ? dailyStats.slice(-7) : period === '30d' ? dailyStats.slice(-30) : dailyStats

  return (
    <div className="bg-card border border-border p-4">
      <h3 className="text-secondary text-sm mb-4">DAILY COST</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#161616', border: '1px solid #2a2a2a' }}
              labelStyle={{ color: '#f5f5f5' }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
            />
            <Bar dataKey="totalCostUsd">
              {displayData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.totalCostUsd > avgCost * 2
                      ? '#ef4444'
                      : entry.totalCostUsd > avgCost
                        ? '#f59e0b'
                        : '#10b981'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}