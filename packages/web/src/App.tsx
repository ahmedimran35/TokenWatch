import { useState, useMemo } from 'react'
import { useLiveStats, useProjects, useSessions, useModels, useCacheStats, useAlerts, useAlertConfig, useBurnRateHistory, useUpdateFromWebSocket, useOverviewStats, useTools, useShellCommands, useActivities, useForecast, useSessionEvents, useModelCompare, useOptimize, useYield } from './hooks/useStats'
import { LiveBurnRate } from './components/LiveBurnRate'
import { DailyActivity } from './components/DailyActivity'
import { ByActivity } from './components/ByActivity'
import { CoreTools } from './components/CoreTools'
import { ShellCommands } from './components/ShellCommands'
import { ModelPieChart } from './components/ModelPieChart'
import { ProjectBreakdown } from './components/ProjectBreakdown'
import { CacheStats } from './components/CacheStats'
import { AlertBadge } from './components/AlertBadge'
import { AlertsPanel } from './components/AlertsPanel'
import { ConnectionStatus } from './components/ConnectionStatus'
import { PeriodSelector } from './components/PeriodSelector'
import { StatCard } from './components/StatCard'
import { SessionTable } from './components/SessionTable'
import { SessionTimeline } from './components/SessionTimeline'
import { ForecastCard } from './components/ForecastCard'
import { ModelCompare } from './components/ModelCompare'
import { OptimizePanel } from './components/OptimizePanel'
import { YieldPanel } from './components/YieldPanel'

function App() {
  const [period, setPeriod] = useState('7d')
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [showAlerts, setShowAlerts] = useState(false)

  useUpdateFromWebSocket()

  const { data: liveData } = useLiveStats()
  const { data: alerts } = useAlerts()
  const { data: alertConfig } = useAlertConfig()

  const { from, to } = useMemo(() => {
    const now = new Date()
    let from: Date
    switch (period) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        from = new Date(0)
    }
    return { from, to: now }
  }, [period])

  const { data: overview } = useOverviewStats(from, to)
  const { data: projects } = useProjects(from, to)
  const { data: sessions } = useSessions(from, to)
  const { data: models } = useModels(from, to)
  const { data: cache } = useCacheStats(from, to)
  const { data: burnRateHistory } = useBurnRateHistory(30, 5)
  const { data: tools } = useTools(from, to)
  const { data: shellCommands } = useShellCommands(from, to)
  const { data: activities } = useActivities(from, to)
  const { data: forecast } = useForecast()
  const { data: sessionEvents } = useSessionEvents(selectedSession || '')
  const { data: modelCompare } = useModelCompare(from, to)
  const { data: optimizeResult } = useOptimize(from, to)
  const { data: yieldData } = useYield(from, to)

  const handleAcknowledge = async (id: string) => {
    await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' })
  }

  const handleSaveConfig = async (config: any) => {
    await fetch('/api/alerts/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
  }

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toString()
  }

  const sparklineData = useMemo(() => {
    if (!Array.isArray(burnRateHistory)) return []
    return burnRateHistory.slice(-30).map((b: any) => ({ tokensPerMinute: b.tokensPerMinute }))
  }, [burnRateHistory])

  const alertCount = (alerts as any[])?.filter((a: any) => !a.acknowledged).length || 0

  const totalCost = (overview as any)?.totalCostUsd ?? 0
  const totalTokens = (overview as any)?.totalTokens ?? 0
  const totalSessions = (overview as any)?.sessionCount ?? 0
  const dailyBreakdown = (overview as any)?.dailyBreakdown || []

  return (
    <div className="min-h-screen bg-[#1a1b26] p-4 text-sm font-mono">
      {/* Header */}
      <header className="flex items-center justify-between mb-4 border border-[#f59e0b]/30 p-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-[#f59e0b]">◈ tokenwatch</h1>
          <span className="text-secondary text-xs">{period}</span>
          <span className="text-[#f59e0b]">${totalCost.toFixed(2)} cost</span>
          <span className="text-secondary">{formatNumber(totalTokens)} tokens</span>
          <span className="text-secondary">{totalSessions} sessions</span>
          <span className="text-secondary">{((cache as any)?.hitRate * 100 || 0).toFixed(0)}% cache hit</span>
          {(liveData as any)?.providers && (liveData as any).providers.length > 0 && (
            <span className="text-secondary">{(liveData as any).providers.join(', ')}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={period} onChange={setPeriod} />
          <AlertBadge count={alertCount} onClick={() => setShowAlerts(true)} />
          <ConnectionStatus isConnected={true} />
        </div>
      </header>

      {/* Top stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="TODAY"
          value={`$${((liveData as any)?.todayCost ?? 0).toFixed(4)}`}
          subValue={`${formatNumber((liveData as any)?.todayTokens || 0)} tokens`}
          color="accent"
        />
        <StatCard
          label="THIS MONTH"
          value={`$${((liveData as any)?.monthCost ?? 0).toFixed(2)}`}
          subValue={`${formatNumber((liveData as any)?.monthTokens || 0)} tokens`}
        />
        <CacheStats
          hitRate={(cache as any)?.hitRate}
          estimatedSavingsUsd={(cache as any)?.estimatedSavingsUsd}
        />
        <LiveBurnRate
          burnRate={(liveData as any)?.burnRate}
          isConnected={true}
          sparklineData={sparklineData}
        />
      </div>

      {/* Session Timeline (when a session is selected) */}
      {selectedSession && (
        <div className="mb-3">
          <SessionTimeline
            events={(sessionEvents as any[]) || []}
            session={(sessions as any[])?.find((s: any) => s.id === selectedSession)}
            onClose={() => setSelectedSession(null)}
          />
        </div>
      )}

      {/* Forecast */}
      <div className="mb-3">
        <ForecastCard forecast={forecast as any} />
      </div>

      {/* Daily Activity + By Project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <DailyActivity dailyStats={dailyBreakdown} />
        <ProjectBreakdown projects={(projects as any[]) || []} />
      </div>

      {/* By Activity + By Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <ByActivity activities={(activities as any[]) || []} />
        <ModelCompare
          models={(modelCompare as any)?.models || []}
          categories={(modelCompare as any)?.categories || []}
        />
      </div>

      {/* Core Tools + Shell Commands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <CoreTools tools={(tools as any[]) || []} />
        <ShellCommands commands={(shellCommands as any[]) || []} />
      </div>

      {/* Optimize */}
      <div className="mb-3">
        <OptimizePanel result={(optimizeResult as any) || { findings: [], totalWastedTokens: 0, totalWastedCostUsd: 0, healthGrade: 'A', summary: 'No issues' }} />
      </div>

      {/* Yield Analysis */}
      {yieldData && (
        <div className="mb-3">
          <YieldPanel data={(yieldData as any)} />
        </div>
      )}

      {/* Sessions */}
      <div className="mb-3">
        <SessionTable
          sessions={(sessions as any[]) || []}
          onSelect={(s) => setSelectedSession(s.id)}
        />
      </div>

      {showAlerts && (
        <AlertsPanel
          alerts={(alerts as any[]) || []}
          config={alertConfig as any}
          onAcknowledge={handleAcknowledge}
          onSaveConfig={handleSaveConfig}
          onClose={() => setShowAlerts(false)}
        />
      )}
    </div>
  )
}

export default App
