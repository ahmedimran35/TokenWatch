import React from 'react'
import { Box, Text } from 'ink'

interface ActivityBreakdownProps {
  activities: Array<{
    name: string
    calls: number
    totalCostUsd: number
    totalTokens: number
    oneShotRate?: number
  }>
}

const ACTIVITY_COLORS: Record<string, string> = {
  Coding: 'red',
  Exploration: 'yellow',
  Debugging: 'green',
  'Feature Dev': 'blue',
  Delegation: 'magenta',
  Conversation: 'cyan',
  Testing: 'blue',
  Brainstorming: 'yellow',
  Refactoring: 'green',
  'Build/Deploy': 'cyan',
  General: 'gray',
  'Git Ops': 'magenta',
  Planning: 'magenta',
}

const BAR_WIDTH = 30

export function ActivityBreakdown({ activities }: ActivityBreakdownProps) {
  if (!activities || activities.length === 0) {
    return <Text color="gray">No activity data</Text>
  }

  const maxCost = Math.max(...activities.map(a => a.totalCostUsd), 0.001)
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray" bold>BY ACTIVITY</Text>
        <Text color="gray">     </Text>
        <Text color="gray">{'cost'.padEnd(10)}</Text>
        <Text color="gray">{'turns'.padEnd(8)}</Text>
        <Text color="gray">{'tokens'.padEnd(10)}</Text>
        <Text color="gray">1-shot</Text>
      </Box>
      <Text color="gray">{'─'.repeat(80)}</Text>
      {activities.map((a) => {
        const barLen = Math.round((a.totalCostUsd / maxCost) * BAR_WIDTH)
        const bar = '█'.repeat(barLen) + '░'.repeat(BAR_WIDTH - barLen)
        const color = ACTIVITY_COLORS[a.name] || 'gray'
        const shotColor = a.oneShotRate !== undefined
          ? a.oneShotRate >= 0.8 ? 'green' : a.oneShotRate >= 0.5 ? 'yellow' : 'red'
          : 'gray'

        return (
          <Box key={a.name}>
            <Text color={color}>{a.name.padEnd(16)}</Text>
            <Text color={color}>{bar}</Text>
            <Text color="yellow">  ${a.totalCostUsd.toFixed(2).padStart(7)}</Text>
            <Text color="gray">  {a.calls.toString().padStart(6)}</Text>
            <Text color="gray">  {fmt(a.totalTokens).padStart(8)}</Text>
            <Text color={shotColor}>  {a.oneShotRate !== undefined ? `${Math.round(a.oneShotRate * 100)}%` : '-'}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
