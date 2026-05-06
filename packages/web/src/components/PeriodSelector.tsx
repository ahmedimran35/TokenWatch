import { useState } from 'react'

interface PeriodSelectorProps {
  value: string
  onChange: (period: string) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All Time' },
  ]

  return (
    <div className="flex border border-border">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-sm transition-colors ${
            value === p.value
              ? 'bg-accent text-black font-medium'
              : 'text-secondary hover:text-primary hover:bg-border/50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}