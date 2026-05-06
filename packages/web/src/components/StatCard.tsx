interface StatCardProps {
  label: string
  value: string
  subValue?: string
  color?: 'default' | 'accent' | 'success'
}

export function StatCard({ label, value, subValue, color = 'default' }: StatCardProps) {
  const colorClass = color === 'accent' ? 'text-accent' : color === 'success' ? 'text-success' : ''

  return (
    <div className="bg-card border border-border p-4">
      <div className="text-secondary text-xs mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${colorClass}`}>{value}</div>
      {subValue && <div className="text-secondary text-xs mt-1">{subValue}</div>}
    </div>
  )
}