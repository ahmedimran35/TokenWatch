import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { ModelStats } from '@tokenwatch/types'

interface ModelPieChartProps {
  models: ModelStats[]
}

export function ModelPieChart({ models }: ModelPieChartProps) {
  const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899']

  const data = models.slice(0, 6).map((m) => ({
    name: (m.model || 'unknown').replace('claude-', '').replace(/-/g, ' ').slice(0, 15),
    value: m.totalCostUsd,
    percentage: models.length > 0 ? (m.totalCostUsd / models.reduce((a, b) => a + b.totalCostUsd, 0)) * 100 : 0,
  }))

  return (
    <div className="bg-card border border-border p-4">
      <h3 className="text-secondary text-sm mb-4">MODELS</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#161616', border: '1px solid #2a2a2a' }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
            />
            <Legend
              wrapperStyle={{ fontSize: 10 }}
              formatter={(value) => <span className="text-secondary">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}