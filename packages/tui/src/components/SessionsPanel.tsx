import React from 'react'
import { Box, Text } from 'ink'
import { Database } from '@tokenwatch/collector'
import { getTopSessions } from '@tokenwatch/engine'

interface SessionsPanelProps {
  db: Database
  period: string
}

function getPeriodDates(period: string) {
  const now = new Date()
  let from: Date
  switch (period) {
    case 'today': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case '7d': from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case '30d': from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break
    default: from = new Date(0)
  }
  return { from, to: now }
}

export function SessionsPanel({ db, period }: SessionsPanelProps) {
  const dates = getPeriodDates(period)
  const sessions = getTopSessions(db, { from: dates.from, to: dates.to, limit: 10, sortBy: 'cost' })
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

  if (sessions.length === 0) {
    return <Text color="gray">No sessions</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>TOP SESSIONS</Text>
      <Text color="gray">{'─'.repeat(90)}</Text>
      <Box>
        <Text color="gray">{'project'.padEnd(22)}</Text>
        <Text color="gray">{'provider'.padEnd(12)}</Text>
        <Text color="gray">{'started'.padEnd(18)}</Text>
        <Text color="gray">{'cost'.padEnd(12)}</Text>
        <Text color="gray">{'tokens'.padEnd(10)}</Text>
        <Text color="gray">{'events'.padEnd(8)}</Text>
        <Text color="gray">models</Text>
      </Box>
      <Text color="gray">{'─'.repeat(90)}</Text>
      {sessions.map((s: any) => {
        const started = new Date(s.startedAt)
        const dateStr = `${(started.getMonth() + 1).toString().padStart(2, '0')}/${started.getDate().toString().padStart(2, '0')} ${started.getHours().toString().padStart(2, '0')}:${started.getMinutes().toString().padStart(2, '0')}`

        return (
          <Box key={s.id}>
            <Text color="cyan">{s.projectName.slice(0, 20).padEnd(22)}</Text>
            <Text color="gray">{s.provider.padEnd(12)}</Text>
            <Text color="gray">{dateStr.padEnd(18)}</Text>
            <Text color="yellow">${s.totalCostUsd.toFixed(4).padStart(10)}</Text>
            <Text color="gray">  {fmt(s.totalTokens).padStart(8)}</Text>
            <Text color="gray">  {s.eventCount.toString().padStart(6)}</Text>
            <Text color="gray">  {s.modelsUsed?.slice(0, 2).join(', ') || '-'}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
