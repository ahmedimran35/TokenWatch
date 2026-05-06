import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { Database } from '@tokenwatch/collector'
import {
  getStats,
  calculateBurnRate,
  getActivityStatsWithClassification,
  getModelStats,
  getProjectStats,
  analyzeYield,
  getContextWasteReport,
  getZombieSessions,
  getSessionHealthScores,
} from '@tokenwatch/engine'

const PERIODS = ['Today', '7 Days', '30 Days', 'Month'] as const

type PeriodKey = typeof PERIODS[number]

const PERIOD_COLORS: Record<PeriodKey, string> = {
  Today: 'yellow',
  '7 Days': 'green',
  '30 Days': 'cyan',
  Month: 'magentaBright',
}

function getPeriodDates(period: PeriodKey) {
  const now = new Date()
  let from: Date
  switch (period) {
    case 'Today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case '7 Days':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30 Days':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'Month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }
  return { from, to: now }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(n % 1 === 0 ? 0 : 2)
}

function fmtCost(n: number): string {
  return `$${n.toFixed(n >= 100 ? 0 : n >= 1 ? 2 : 4)}`
}

function safeMax(arr: number[], fallback: number): number {
  if (arr.length === 0) return fallback
  let max = arr[0]
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i]
  }
  return max
}

function gradientBar(pct: number, width: number, color: string): string {
  const filled = Math.round(pct * width)
  if (filled <= 0) return ' '.repeat(width)
  return '\u2588'.repeat(filled) + ' '.repeat(width - filled)
}

function Panel({ title, color, children, width }: { title: string; color: string; children: React.ReactNode; width: number }) {
  return (
    <Box flexDirection="column" width={width}>
      <Box>
        <Text color="gray"></Text>
        <Text color={color}>─</Text>
        <Text color={color} bold> {title} </Text>
        <Text color="gray">{'─'.repeat(Math.max(0, width - title.length - 4))}</Text>
        <Text color="gray">╮</Text>
      </Box>
      {children}
      <Box>
        <Text color="gray"></Text>
        <Text color="gray">{'─'.repeat(width - 2)}</Text>
        <Text color="gray">╯</Text>
      </Box>
    </Box>
  )
}

interface DashboardData {
  stats: any
  burnRate: any
  activities: any[]
  models: any[]
  projects: any[]
  tools: any[]
  shellCmds: any[]
  yieldResult: any
  providers: string[]
  contextWaste: any
  zombieSessions: any[]
  healthScores: any[]
}

function PanelContent({ data, period }: { data: DashboardData; period: PeriodKey }) {
  const colWidth = Math.floor((Math.min(process.stdout.columns || 120, 130) - 6) / 2)
  const barWidth = Math.floor(colWidth * 0.35)

  const { stats, activities, models, projects, tools, shellCmds, yieldResult, providers, contextWaste, zombieSessions, healthScores } = data

  const activityColorMap: Record<string, string> = {
    Coding: 'cyan',
    Exploration: 'blue',
    Debugging: 'red',
    'Feature Dev': 'green',
    Delegation: 'yellow',
    Conversation: 'gray',
    Testing: 'magenta',
    Brainstorming: 'magentaBright',
    Refactoring: 'greenBright',
    'Build/Deploy': 'green',
    General: 'gray',
    'Git Ops': 'blue',
    Planning: 'blue',
  }

  const toolColors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'gray']

  return (
    <Box flexDirection="column">
      {/* Row 1: Active Providers */}
      {providers.length > 0 && (
        <>
          <Box>
            <Panel title="Active Providers" color="green" width={colWidth}>
              {providers.map((p: string, i: number) => (
                <Text key={p} color="green">  ● {p}</Text>
              ))}
              {providers.length === 0 && <Text color="gray">  No providers detected</Text>}
            </Panel>
          </Box>
          <Box height={1} />
        </>
      )}

      {/* Row 2: Daily Activity + By Project */}
      <Box>
        <Panel title="Daily Activity" color="blue" width={colWidth}>
          {stats.dailyBreakdown?.slice(-8).map((day: any, i: number) => {
            const maxCost = safeMax((stats.dailyBreakdown || []).map((d: any) => d.totalCostUsd), 0.001)
            const pct = day.totalCostUsd / maxCost
            const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
            const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
            const dateStr = day.date?.slice(5) || ''
            return (
              <Box key={day.date}>
                <Text color="gray">{dateStr.padEnd(5)}</Text>
                <Text color={pct > 0.7 ? 'red' : pct > 0.4 ? 'yellow' : 'blue'}> {bar} </Text>
                <Text color="yellow" bold>{fmtCost(day.totalCostUsd).padStart(7)}</Text>
                <Text color="gray">  </Text>
                <Text color="gray">{String(day.sessionCount || 0).padStart(4)}</Text>
              </Box>
            )
          })}
          {(!stats.dailyBreakdown || stats.dailyBreakdown.length === 0) && (
            <Text color="gray">  No data</Text>
          )}
        </Panel>

        <Box width={2} />

        <Panel title="By Project" color="green" width={colWidth}>
          {projects.slice(0, 8).map((p: any, i: number) => {
            const maxCost = safeMax(projects.map((x: any) => x.totalCostUsd), 0.001)
            const pct = p.totalCostUsd / maxCost
            const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
            const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
            const name = p.projectName?.slice(0, 18) || ''
            return (
              <Box key={p.projectName}>
                <Text color="green">{name.padEnd(18)}</Text>
                <Text color="green"> </Text>
                <Text color="green">{bar}</Text>
                <Text color="gray">  </Text>
                <Text color="yellow" bold>{fmtCost(p.totalCostUsd).padStart(7)}</Text>
                <Text color="gray">  </Text>
                <Text color="gray">{String(p.sessionCount || 0).padStart(3)}</Text>
              </Box>
            )
          })}
          {projects.length === 0 && <Text color="gray">  No data</Text>}
        </Panel>
      </Box>

      <Box height={1} />

      {/* Row 3: By Activity + By Model */}
      <Box>
        <Panel title="By Activity" color="yellow" width={colWidth}>
          {activities.slice(0, 10).map((a: any, i: number) => {
            const maxCost = safeMax(activities.map((x: any) => x.totalCostUsd), 0.001)
            const pct = a.totalCostUsd / maxCost
            const color = activityColorMap[a.name] || 'gray'
            const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
            const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
            const name = (a.name || '').slice(0, 14)
            const oneShot = a.editCalls > 0 ? `${Math.round(a.oneShotRate * 100)}%` : '–'
            return (
              <Box key={a.name}>
                <Text color={color}>{name.padEnd(14)}</Text>
                <Text color={color}> </Text>
                <Text color={color}>{bar}</Text>
                <Text color="gray">  </Text>
                <Text color="yellow" bold>{fmtCost(a.totalCostUsd).padStart(7)}</Text>
                <Text color="gray">  </Text>
                <Text color="gray">{String(a.calls || 0).padStart(4)}</Text>
                <Text color="gray">  </Text>
                <Text color="orange">{oneShot.padStart(3)}</Text>
              </Box>
            )
          })}
          {activities.length === 0 && <Text color="gray">  No data</Text>}
        </Panel>

        <Box width={2} />

        <Panel title="By Model" color="magenta" width={colWidth}>
          {models.slice(0, 8).map((m: any, i: number) => {
            const maxCost = safeMax(models.map((x: any) => x.totalCostUsd), 0.001)
            const pct = m.totalCostUsd / maxCost
            const modelKey = m.model?.toLowerCase() || ''
            let color = 'gray'
            if (modelKey.includes('opus')) color = 'red'
            else if (modelKey.includes('sonnet')) color = 'yellow'
            else if (modelKey.includes('haiku')) color = 'blue'
            else if (modelKey.includes('gpt')) color = 'green'
            const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
            const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
            const name = m.model?.replace('claude-', '').slice(0, 16) || ''
            return (
              <Box key={m.model}>
                <Text color={color}>{name.padEnd(16)}</Text>
                <Text color={color}> </Text>
                <Text color={color}>{bar}</Text>
                <Text color="gray">  </Text>
                <Text color="yellow" bold>{fmtCost(m.totalCostUsd).padStart(7)}</Text>
                <Text color="gray">  </Text>
                <Text color="gray">{String(m.callCount || 0).padStart(5)}</Text>
              </Box>
            )
          })}
          {models.length === 0 && <Text color="gray">  No data</Text>}
        </Panel>
      </Box>

      <Box height={1} />

      {/* Row 4: Yield Analysis */}
      {yieldResult && (
        <>
          <Box>
            <Panel title="Yield Analysis" color="cyan" width={colWidth}>
              <Text color="green">  ● Productive:  {yieldResult.productive.sessions} sessions ({fmtCost(yieldResult.productive.costUsd)})</Text>
              <Text color="yellow">  ● Reverted:    {yieldResult.reverted.sessions} sessions ({fmtCost(yieldResult.reverted.costUsd)})</Text>
              <Text color="red">  ● Abandoned:   {yieldResult.abandoned.sessions} sessions ({fmtCost(yieldResult.abandoned.costUsd)})</Text>
              <Text color="gray">{'─'.repeat(colWidth - 4)}</Text>
              <Text color="gray">  Total: {fmtCost(yieldResult.totalCostUsd)} · {fmt(yieldResult.totalTokens)} tokens</Text>
            </Panel>
            <Box width={2} />
            <Panel title="Core Tools" color="cyan" width={colWidth}>
              {tools.slice(0, 10).map((t: any, i: number) => {
                const maxCalls = safeMax(tools.map((x: any) => x.calls), 1)
                const pct = t.calls / maxCalls
                const color = toolColors[i % toolColors.length]
                const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
                const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
                const name = (t.tool || '').slice(0, 14)
                return (
                  <Box key={t.tool}>
                    <Text color={color}>{name.padEnd(14)}</Text>
                    <Text color={color}> </Text>
                    <Text color={color}>{bar}</Text>
                    <Text color="gray">  </Text>
                    <Text color="gray">{String(t.calls).padStart(5)}</Text>
                  </Box>
                )
              })}
              {tools.length === 0 && <Text color="gray">  No data</Text>}
            </Panel>
          </Box>
          <Box height={1} />
        </>
      )}

      {/* Row 5: Health Insights */}
      {contextWaste && (
        <>
          <Box>
            <Panel title="Context Waste" color="orange" width={colWidth}>
              <Text color="orange">  Waste: {Math.round(contextWaste.wastePercentage || 0)}%</Text>
              <Text color="gray">  Input:  {fmt(contextWaste.totalInputTokens || 0)}</Text>
              <Text color="gray">  Output: {fmt(contextWaste.totalOutputTokens || 0)}</Text>
              <Text color="red">  Wasted: {fmt(contextWaste.totalWastedTokens || 0)} tokens</Text>
              {contextWaste.sessionsWithHighWaste && contextWaste.sessionsWithHighWaste.length > 0 && (
                <>
                  <Text color="gray">{'─'.repeat(colWidth - 4)}</Text>
                  {contextWaste.sessionsWithHighWaste.slice(0, 3).map((s: any, i: number) => (
                    <Text key={s.sessionId} color="gray">  #{i + 1} {s.projectName?.slice(0, 12) || 'unknown'} ({fmt(s.wastedTokens)} tokens)</Text>
                  ))}
                </>
              )}
            </Panel>
            <Box width={2} />
            <Panel title="Session Health" color="magenta" width={colWidth}>
              {healthScores && healthScores.length > 0 ? (
                <>
                  {(() => {
                    const healthy = healthScores.filter((s: any) => s.status === 'healthy').length
                    const avg = healthScores.filter((s: any) => s.status === 'average').length
                    const poor = healthScores.filter((s: any) => s.status === 'poor').length
                    const stuck = healthScores.filter((s: any) => s.status === 'stuck').length
                    const avgScore = Math.round(healthScores.reduce((a: number, b: any) => a + b.score, 0) / healthScores.length)
                    return (
                      <>
                        <Text color="green">  ● Healthy:  {healthy}</Text>
                        <Text color="yellow">  ● Average:  {avg}</Text>
                        <Text color="orange">  ● Poor:     {poor}</Text>
                        <Text color="red">  ● Stuck:    {stuck}</Text>
                        <Text color="gray">{'─'.repeat(colWidth - 4)}</Text>
                        <Text color="gray">  Avg Score: {avgScore}/100</Text>
                      </>
                    )
                  })()}
                </>
              ) : (
                <Text color="gray">  No health data (needs input tokens)</Text>
              )}
            </Panel>
          </Box>
          <Box height={1} />
        </>
      )}

      {/* Row 6: Tools + Shell (if no Yield) */}
      {!yieldResult && (
        <Box>
          <Panel title="Core Tools" color="cyan" width={colWidth}>
            {tools.slice(0, 10).map((t: any, i: number) => {
              const maxCalls = safeMax(tools.map((x: any) => x.calls), 1)
              const pct = t.calls / maxCalls
              const color = toolColors[i % toolColors.length]
              const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
              const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
              const name = (t.tool || '').slice(0, 14)
              return (
                <Box key={t.tool}>
                  <Text color={color}>{name.padEnd(14)}</Text>
                  <Text color={color}> </Text>
                  <Text color={color}>{bar}</Text>
                  <Text color="gray">  </Text>
                  <Text color="gray">{String(t.calls).padStart(5)}</Text>
                </Box>
              )
            })}
            {tools.length === 0 && <Text color="gray">  No data</Text>}
          </Panel>

          <Box width={2} />

          <Panel title="Shell Commands" color="orange" width={colWidth}>
            {shellCmds.slice(0, 10).map((s: any, i: number) => {
              const maxCalls = safeMax(shellCmds.map((x: any) => x.calls), 1)
              const pct = s.calls / maxCalls
              const color = toolColors[i % toolColors.length]
              const barLen = Math.max(1, Math.round(pct * (barWidth - 2)))
              const bar = '█'.repeat(barLen) + ' '.repeat(barWidth - 2 - barLen)
              const name = (s.command || '').slice(0, 14)
              return (
                <Box key={s.command}>
                  <Text color={color}>{name.padEnd(14)}</Text>
                  <Text color={color}> </Text>
                  <Text color={color}>{bar}</Text>
                  <Text color="gray">  </Text>
                  <Text color="gray">{String(s.calls).padStart(5)}</Text>
                </Box>
              )
            })}
            {shellCmds.length === 0 && <Text color="gray">  No data</Text>}
          </Panel>
        </Box>
      )}
    </Box>
  )
}

export default function App({ db }: { db: Database }) {
  const { exit } = useApp()
  const [period, setPeriod] = useState<PeriodKey>('7 Days')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodIndex, setPeriodIndex] = useState(1)

  const fetchAll = useCallback(() => {
    const dates = getPeriodDates(period)
    const stats = getStats(db, dates)
    const burnRate = calculateBurnRate(db, 5)
    const activities = getActivityStatsWithClassification(db, dates)

    const models = getModelStats(db, dates)
    const projects = getProjectStats(db, { ...dates, limit: 10 })

    // Tool stats
    const toolCounts = new Map<string, number>()
    const shellCmdCounts = new Map<string, number>()
    const sqliteDb = db.getDatabase()
    const fromStr = dates.from.toISOString()
    const toStr = dates.to.toISOString()

    const events = sqliteDb.prepare(
      `SELECT tool_name, tool_input FROM token_events WHERE timestamp >= ? AND timestamp <= ? AND tool_name IS NOT NULL`
    ).all(fromStr, toStr) as Array<{ tool_name: string; tool_input: string | null }>

    for (const e of events) {
      if (e.tool_name) {
        toolCounts.set(e.tool_name, (toolCounts.get(e.tool_name) || 0) + 1)
      }

      if (e.tool_name === 'Bash' && e.tool_input) {
        try {
          const parsed = JSON.parse(e.tool_input)
          const cmd = parsed.command?.split(' ')[0] || ''
          if (cmd) {
            shellCmdCounts.set(cmd, (shellCmdCounts.get(cmd) || 0) + 1)
          }
        } catch {
          // ignore
        }
      }
    }

    const tools = Array.from(toolCounts.entries())
      .map(([tool, calls]) => ({ tool, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 12)

    const shellCmds = Array.from(shellCmdCounts.entries())
      .map(([command, calls]) => ({ command, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 12)

    // Yield analysis
    const sessions = sqliteDb.prepare(
      `SELECT id, project_path, project_name, provider, started_at, ended_at, total_cost_usd, total_tokens
       FROM sessions WHERE started_at >= ? AND started_at <= ?`
    ).all(fromStr, toStr) as Array<{
      id: string; project_path: string; project_name: string; provider: string;
      started_at: string; ended_at: string | null; total_cost_usd: number; total_tokens: number
    }>

    const yieldResult = analyzeYield(
      sessions.map((s: any) => ({
        id: s.id,
        projectPath: s.project_path,
        startedAt: new Date(s.started_at),
        endedAt: s.ended_at ? new Date(s.ended_at) : undefined,
        totalCostUsd: s.total_cost_usd,
        totalTokens: s.total_tokens,
      })),
    )

    const providers = db
      .getDatabase()
      .prepare(`SELECT DISTINCT provider FROM token_events WHERE provider IS NOT NULL AND provider != ''`)
      .all()
      .map((r: any) => r.provider)

    const contextWaste = getContextWasteReport(db, dates.from, dates.to)
    const zombieSessions = getZombieSessions(db, 30)
    const healthScores = getSessionHealthScores(db, dates.from, dates.to)

    setData({ stats, burnRate, activities, models, projects, tools, shellCmds, yieldResult, providers, contextWaste, zombieSessions, healthScores })
    setLoading(false)
  }, [db, period])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  useInput((input: string) => {
    if (input === 'q' || input === 'Q') exit()

    if (input === '1') { setPeriod('Today'); setPeriodIndex(0); return }
    if (input === '2') { setPeriod('7 Days'); setPeriodIndex(1); return }
    if (input === '3') { setPeriod('30 Days'); setPeriodIndex(2); return }
    if (input === '4') { setPeriod('Month'); setPeriodIndex(3); return }

    if (input === 'left' && periodIndex > 0) {
      const newIdx = periodIndex - 1
      setPeriodIndex(newIdx)
      setPeriod(PERIODS[newIdx])
    }
    if (input === 'right' && periodIndex < PERIODS.length - 1) {
      const newIdx = periodIndex + 1
      setPeriodIndex(newIdx)
      setPeriod(PERIODS[newIdx])
    }
  })

  if (loading && !data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold> tokenwatch</Text>
        <Text color="gray">Loading...</Text>
      </Box>
    )
  }

  if (!data) return null

  const { stats, zombieSessions } = data
  const screenW = Math.min(process.stdout.columns || 120, 130)

  return (
    <Box flexDirection="column" padding={1} width={screenW}>
      {/* Top bar: Period selector */}
      <Box>
        <Text color="gray">  </Text>
        {PERIODS.map((p, i) => (
          <React.Fragment key={p}>
            <Text color={i === periodIndex ? PERIOD_COLORS[p] : 'gray'} bold={i === periodIndex}>
              {i === periodIndex ? `[${p}]` : p}
            </Text>
            <Text color="gray">  </Text>
          </React.Fragment>
        ))}
        <Text color="gray">{' '.repeat(Math.max(2, screenW - 60))}</Text>
        <Text color="cyan" bold>[r] refresh</Text>
        <Text color="gray">  </Text>
        <Text color="gray" bold>[q] quit</Text>
      </Box>

      <Box height={1} />

      {/* Summary bar */}
      <Box>
        <Text color="gray">╭</Text>
        <Text color="orange">{'─'.repeat(screenW - 2)}</Text>
        <Text color="gray">╮</Text>
      </Box>
      <Box>
        <Text color="gray">│ </Text>
        <Text color="cyan" bold>tokenwatch</Text>
        <Text color="gray">  </Text>
        <Text color="yellow" bold>{fmtCost(stats.totalCostUsd)}</Text>
        <Text color="gray"> cost  </Text>
        <Text color="gray">{fmt(stats.totalTokens)} tokens  </Text>
        <Text color="gray">{stats.sessionCount} sessions  </Text>
        <Text color="gray">{(stats.cacheHitRate * 100).toFixed(0)}% cache</Text>
        {zombieSessions && zombieSessions.length > 0 && (
          <>
            <Text color="gray">  </Text>
            <Text color="red" bold>⚠ {zombieSessions.length} zombie</Text>
          </>
        )}
        <Text color="gray">{' '.repeat(Math.max(2, screenW - 80))}</Text>
      </Box>
      <Box>
        <Text color="gray">│ </Text>
        <Text color="gray">{fmt(stats.totalInputTokens)} in  </Text>
        <Text color="gray">{fmt(stats.totalOutputTokens)} out  </Text>
        <Text color="gray">{fmt(stats.totalCacheReadTokens)} cached  </Text>
        <Text color="gray">{fmt(stats.totalCacheWriteTokens)} written  </Text>
        <Text color="gray">{' '.repeat(Math.max(2, screenW - 60))}</Text>
        <Text color="gray">│</Text>
      </Box>
      <Box>
        <Text color="gray">╰</Text>
        <Text color="orange">{'─'.repeat(screenW - 2)}</Text>
        <Text color="gray">╯</Text>
      </Box>

      <Box height={1} />

      {/* Dashboard panels */}
      <PanelContent data={data} period={period} />

      <Box height={1} />

      {/* Footer */}
      <Box>
        <Text color="gray">1-4:period  ←→:switch  q:quit</Text>
      </Box>
    </Box>
  )
}

