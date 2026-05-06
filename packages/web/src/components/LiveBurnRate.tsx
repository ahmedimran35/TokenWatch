import { useMemo, useEffect, useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface LiveBurnRateProps {
  burnRate?: {
    tokensPerMinute: number
    costPerMinute: number
    costPerHour: number
    costPerDay: number
  }
  isConnected?: boolean
  sparklineData?: Array<{ tokensPerMinute: number }>
}

export function LiveBurnRate({ burnRate, isConnected, sparklineData = [] }: LiveBurnRateProps) {
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (burnRate && burnRate.tokensPerMinute > 0) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 300)
      return () => clearTimeout(timer)
    }
  }, [burnRate?.tokensPerMinute])

  const statusColor = useMemo(() => {
    if (!isConnected) return 'bg-red-500'
    return 'bg-success'
  }, [isConnected])

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className={`bg-card border border-border p-4 transition-colors ${flash ? 'bg-accent/10' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
        <span className="text-secondary text-sm">BURN RATE</span>
      </div>
      <div className="font-mono text-3xl font-bold mb-1">
        {burnRate ? formatNumber(burnRate.tokensPerMinute) : '0'} <span className="text-secondary text-lg">tokens/min</span>
      </div>
      <div className="text-accent font-mono text-sm mb-3">
        ${(burnRate?.costPerMinute ?? 0).toFixed(4)}/min · ${(burnRate?.costPerHour ?? 0).toFixed(2)}/hr · ${(burnRate?.costPerDay ?? 0).toFixed(2)}/day
      </div>
      {sparklineData.length > 0 && (
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <Area
                type="monotone"
                dataKey="tokensPerMinute"
                stroke="#10b981"
                fill="#10b98120"
                strokeWidth={1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}