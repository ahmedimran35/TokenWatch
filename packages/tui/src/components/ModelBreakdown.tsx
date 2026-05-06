import React from 'react'
import { Box, Text } from 'ink'

interface ModelBreakdownProps {
  models: Array<{
    model: string
    totalCostUsd: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadTokens: number
    totalCacheWriteTokens: number
    callCount: number
    avgCostPerCall: number
  }>
}

const BAR_WIDTH = 30

export function ModelBreakdown({ models }: ModelBreakdownProps) {
  if (!models || models.length === 0) {
    return <Text color="gray">No model data</Text>
  }

  const maxCost = Math.max(...models.map(m => m.totalCostUsd), 0.001)
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>BY MODEL</Text>
      <Text color="gray">{'─'.repeat(90)}</Text>
      {models.map((m) => {
        const barLen = Math.round((m.totalCostUsd / maxCost) * BAR_WIDTH)
        const bar = '█'.repeat(barLen) + '░'.repeat(BAR_WIDTH - barLen)
        const totalTokens = m.totalInputTokens + m.totalOutputTokens + m.totalCacheReadTokens + m.totalCacheWriteTokens

        return (
          <Box key={m.model}>
            <Text color="cyan" bold>{m.model.slice(0, 24).padEnd(25)}</Text>
            <Text color="yellow">{bar}</Text>
            <Text color="yellow">  ${m.totalCostUsd.toFixed(2).padStart(7)}</Text>
            <Text color="gray">  {m.callCount.toString().padStart(5)} calls</Text>
            <Text color="gray">  {fmt(totalTokens).padStart(8)} tokens</Text>
          </Box>
        )
      })}
      <Box marginTop={1}>
        <Text color="gray">{'─'.repeat(90)}</Text>
      </Box>
      <Text color="gray" bold>DETAILS</Text>
      {models.map((m) => {
        const totalTokens = m.totalInputTokens + m.totalOutputTokens + m.totalCacheReadTokens + m.totalCacheWriteTokens
        const cacheRate = m.totalInputTokens + m.totalCacheReadTokens > 0
          ? (m.totalCacheReadTokens / (m.totalInputTokens + m.totalCacheReadTokens) * 100).toFixed(0)
          : '0'

        return (
          <Box key={m.model}>
            <Text color="gray">{m.model.slice(0, 24).padEnd(25)}</Text>
            <Text color="gray">In: {fmt(m.totalInputTokens).padStart(6)}</Text>
            <Text color="gray">  Out: {fmt(m.totalOutputTokens).padStart(6)}</Text>
            <Text color="gray">  Cache: {fmt(m.totalCacheReadTokens).padStart(6)}</Text>
            <Text color="gray">  Hit: {cacheRate.padStart(3)}%</Text>
            <Text color="gray">  Avg/call: ${m.avgCostPerCall.toFixed(4)}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
