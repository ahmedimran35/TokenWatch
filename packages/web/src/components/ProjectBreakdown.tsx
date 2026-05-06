import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProjectStats } from '@tokenwatch/types'

interface ProjectBreakdownProps {
  projects: ProjectStats[]
}

export function ProjectBreakdown({ projects }: ProjectBreakdownProps) {
  const displayProjects = (projects || []).slice(0, 10)

  return (
    <div className="bg-card border border-border p-4">
      <h3 className="text-secondary text-sm mb-4">PROJECTS</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayProjects} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
            <YAxis
              type="category"
              dataKey="projectName"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={80}
              tickFormatter={(v) => { const s = v || ''; return s.length > 10 ? s.slice(0, 10) + '...' : s }}
            />
            <Tooltip
              contentStyle={{ background: '#161616', border: '1px solid #2a2a2a' }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
            />
            <Bar dataKey="totalCostUsd" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}