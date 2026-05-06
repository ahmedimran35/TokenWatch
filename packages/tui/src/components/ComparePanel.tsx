import React from 'react'
import { Box, Text } from 'ink'

interface ComparePanelProps {
  data: any
}

export function ComparePanel({ data }: ComparePanelProps) {
  if (!data || !data.models || data.models.length === 0) {
    return <Text color="gray">No model comparison data. Need more sessions.</Text>
  }

  const models = data.models as Array<{
    model: string
    totalCostUsd: number
    totalTokens: number
    callCount: number
    editCount: number
    avgCostPerCall: number
    avgCostPerEdit: number
    avgOutputTokensPerCall: number
    cacheHitRate: number
    oneShotRate: number
    retryRate: number
    selfCorrectionRate: number
    delegationRate: number
    avgToolsPerTurn: number
    sessionCount: number
  }>

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>MODEL COMPARISON</Text>
      <Text color="gray">{'─'.repeat(100)}</Text>

      {/* Performance */}
      <Text color="cyan" bold>Performance</Text>
      <Box>
        <Text color="gray">{'model'.padEnd(26)}</Text>
        <Text color="gray">{'1-shot'.padStart(8)}</Text>
        <Text color="gray">{'retry'.padStart(8)}</Text>
        <Text color="gray">{'correct'.padStart(8)}</Text>
        <Text color="gray">{'edits'.padStart(8)}</Text>
        <Text color="gray">{'sessions'.padStart(10)}</Text>
      </Box>
      {models.map((m) => (
        <Box key={m.model}>
          <Text color="cyan" bold>{m.model.slice(0, 24).padEnd(26)}</Text>
          <Text color={m.oneShotRate >= 0.7 ? 'green' : m.oneShotRate >= 0.4 ? 'yellow' : 'red'}>
            {(Math.round(m.oneShotRate * 100) + '%').padStart(8)}
          </Text>
          <Text color="gray">{(Math.round(m.retryRate * 100) + '%').padStart(8)}</Text>
          <Text color="gray">{(Math.round(m.selfCorrectionRate * 100) + '%').padStart(8)}</Text>
          <Text color="gray">{m.editCount.toString().padStart(8)}</Text>
          <Text color="gray">{m.sessionCount.toString().padStart(10)}</Text>
        </Box>
      ))}

      <Box marginY={1}>
        <Text color="gray">{'─'.repeat(100)}</Text>
      </Box>

      {/* Efficiency */}
      <Text color="cyan" bold>Efficiency</Text>
      <Box>
        <Text color="gray">{'model'.padEnd(26)}</Text>
        <Text color="gray">{'cost/call'.padStart(12)}</Text>
        <Text color="gray">{'cost/edit'.padStart(12)}</Text>
        <Text color="gray">{'out/call'.padStart(10)}</Text>
        <Text color="gray">{'cache%'.padStart(8)}</Text>
        <Text color="gray">{'total'.padStart(10)}</Text>
      </Box>
      {models.map((m) => (
        <Box key={m.model}>
          <Text color="cyan" bold>{m.model.slice(0, 24).padEnd(26)}</Text>
          <Text color="yellow">${m.avgCostPerCall.toFixed(4).padStart(10)}</Text>
          <Text color="yellow">${m.avgCostPerEdit.toFixed(4).padStart(10)}</Text>
          <Text color="gray">{Math.round(m.avgOutputTokensPerCall).toString().padStart(10)}</Text>
          <Text color="gray">{(Math.round(m.cacheHitRate * 100) + '%').padStart(8)}</Text>
          <Text color="gray">${m.totalCostUsd.toFixed(2).padStart(8)}</Text>
        </Box>
      ))}

      <Box marginY={1}>
        <Text color="gray">{'─'.repeat(100)}</Text>
      </Box>

      {/* Behavior */}
      <Text color="cyan" bold>Behavior</Text>
      <Box>
        <Text color="gray">{'model'.padEnd(26)}</Text>
        <Text color="gray">{'delegate'.padStart(10)}</Text>
        <Text color="gray">{'tools/turn'.padStart(12)}</Text>
        <Text color="gray">{'calls'.padStart(8)}</Text>
        <Text color="gray">{'tokens'.padStart(10)}</Text>
      </Box>
      {models.map((m) => (
        <Box key={m.model}>
          <Text color="cyan" bold>{m.model.slice(0, 24).padEnd(26)}</Text>
          <Text color="gray">{(Math.round(m.delegationRate * 100) + '%').padStart(10)}</Text>
          <Text color="gray">{m.avgToolsPerTurn.toFixed(2).padStart(12)}</Text>
          <Text color="gray">{m.callCount.toString().padStart(8)}</Text>
          <Text color="gray">{fmt(m.totalTokens).padStart(10)}</Text>
        </Box>
      ))}

      {/* Category breakdown */}
      {data.categoryComparison && data.categoryComparison.length > 0 && (
        <>
          <Box marginY={1}>
            <Text color="gray">{'─'.repeat(100)}</Text>
          </Box>
          <Text color="cyan" bold>One-shot by Category</Text>
          {data.categoryComparison.slice(0, 8).map((cat: any) => (
            <Box key={cat.category}>
              <Text color="gray">{cat.category.padEnd(16)}</Text>
              {cat.models.map((m: any) => (
                <Text key={m.model} color="gray">
                  {'  '}{m.model.slice(0, 20)}: {Math.round(m.oneShotRate * 100)}%
                </Text>
              ))}
            </Box>
          ))}
        </>
      )}
    </Box>
  )
}
