import React from 'react'
import { Box, Text } from 'ink'

interface DailyChartProps {
  dailyBreakdown: Array<{
    date: string
    totalTokens: number
    totalCostUsd: number
    sessionCount: number
  }>
}

const BAR_WIDTH = 40

export function DailyChart({ dailyBreakdown }: DailyChartProps) {
  if (!dailyBreakdown || dailyBreakdown.length === 0) {
    return <Text color="gray">No daily data</Text>
  }

  const maxCost = Math.max(...dailyBreakdown.map(d => d.totalCostUsd), 0.001)

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>DAILY ACTIVITY</Text>
      <Box>
        <Text color="gray">{'date     '.padEnd(11)}</Text>
        <Text color="gray">{'bar'.padEnd(BAR_WIDTH + 2)}</Text>
        <Text color="gray">{'   cost'.padEnd(12)}</Text>
        <Text color="gray">{'tokens'.padEnd(10)}</Text>
        <Text color="gray">sessions</Text>
      </Box>
      <Text color="gray">{'─'.repeat(90)}</Text>
      {dailyBreakdown.slice(-7).map((day) => {
        const barLen = Math.round((day.totalCostUsd / maxCost) * BAR_WIDTH)
        const bar = '█'.repeat(barLen) + '░'.repeat(BAR_WIDTH - barLen)
        const color = day.totalCostUsd / maxCost > 0.7 ? 'red' : day.totalCostUsd / maxCost > 0.4 ? 'yellow' : 'green'
        const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

        return (
          <Box key={day.date}>
            <Text color="cyan">{day.date.slice(5).padEnd(11)}</Text>
            <Text color={color}>{bar}</Text>
            <Text color="yellow">  ${day.totalCostUsd.toFixed(2).padStart(8)}</Text>
            <Text color="gray">  {fmt(day.totalTokens).padStart(8)}</Text>
            <Text color="gray">  {day.sessionCount}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
