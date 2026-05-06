import React from 'react'
import { Box, Text } from 'ink'

interface OptimizePanelProps {
  data: any
}

const GRADE_COLORS: Record<string, string> = {
  A: 'green',
  B: 'green',
  C: 'yellow',
  D: 'red',
  F: 'red',
}

export function OptimizePanel({ data }: OptimizePanelProps) {
  if (!data) {
    return <Text color="gray">Loading optimization data...</Text>
  }

  const { findings, totalWastedTokens, totalWastedCostUsd, healthGrade, summary } = data
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

  const severityIcon = (sev: string) => {
    switch (sev) {
      case 'critical': return '[!!]'
      case 'warning': return '[! ]'
      default: return '[  ]'
    }
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray" bold>OPTIMIZE  </Text>
        <Text color={GRADE_COLORS[healthGrade] || 'gray'} bold>
          Grade: {healthGrade}
        </Text>
        <Text color="gray">  </Text>
        <Text color="gray">{summary}</Text>
      </Box>

      <Box>
        <Text color="gray">Findings: {findings.length}  </Text>
        <Text color="yellow">Wasted: {fmt(totalWastedTokens)} tokens  </Text>
        <Text color="red">${totalWastedCostUsd.toFixed(4)}</Text>
      </Box>

      <Text color="gray">{'─'.repeat(90)}</Text>

      {findings.length === 0 && (
        <Text color="green">No optimization issues found. Your setup looks good!</Text>
      )}

      {findings.map((finding: any, index: number) => (
        <Box key={finding.id} flexDirection="column" marginY={1}>
          <Box>
            <Text>{severityIcon(finding.severity)} </Text>
            <Text color={finding.severity === 'critical' ? 'red' : finding.severity === 'warning' ? 'yellow' : 'cyan'} bold>
              {finding.title}
            </Text>
          </Box>
          <Text color="gray">  {finding.description}</Text>
          <Text color="gray">  Wasted: {fmt(finding.estimatedTokensWasted)} tokens · ${finding.estimatedCostUsd.toFixed(4)}</Text>
          <Box flexDirection="column" marginLeft={2}>
            <Text color="green">Fix:</Text>
            {finding.fix.split('\n').map((line: string, i: number) => (
              <Text key={i} color="gray">  {line}</Text>
            ))}
          </Box>
          {index < findings.length - 1 && (
            <Text color="gray">{'─'.repeat(90)}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}
