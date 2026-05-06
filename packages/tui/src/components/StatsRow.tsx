import React from 'react'
import { Box, Text } from 'ink'

interface StatsRowProps {
  todayCost: number
  todayTokens: number
  todaySessions: number
  weekCost: number
  weekTokens: number
  weekSessions: number
  monthCost: number
  monthTokens: number
  monthSessions: number
}

export function StatsRow({ todayCost, todayTokens, todaySessions, weekCost, weekTokens, weekSessions, monthCost, monthTokens, monthSessions }: StatsRowProps) {
  const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(1)}K` : n.toString()

  return (
    <Box>
      <Box borderStyle="round" borderColor="gray" paddingX={1} marginRight={1}>
        <Box flexDirection="column">
          <Text color="gray">TODAY</Text>
          <Text bold color="yellow">${todayCost.toFixed(4)}</Text>
          <Text color="gray">{fmt(todayTokens)} tokens</Text>
          <Text color="gray">{todaySessions} sessions</Text>
        </Box>
      </Box>
      <Box borderStyle="round" borderColor="gray" paddingX={1} marginRight={1}>
        <Box flexDirection="column">
          <Text color="gray">7 DAYS</Text>
          <Text bold color="yellow">${weekCost.toFixed(4)}</Text>
          <Text color="gray">{fmt(weekTokens)} tokens</Text>
          <Text color="gray">{weekSessions} sessions</Text>
        </Box>
      </Box>
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Box flexDirection="column">
          <Text color="gray">MONTH</Text>
          <Text bold color="yellow">${monthCost.toFixed(4)}</Text>
          <Text color="gray">{fmt(monthTokens)} tokens</Text>
          <Text color="gray">{monthSessions} sessions</Text>
        </Box>
      </Box>
    </Box>
  )
}