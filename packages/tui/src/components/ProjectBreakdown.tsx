import React from 'react'
import { Box, Text } from 'ink'

interface ProjectBreakdownProps {
  projects: Array<{
    projectName: string
    totalCostUsd: number
    totalTokens: number
    sessionCount: number
    avgCostPerSession: number
    lastActiveAt: Date
  }>
}

const BAR_WIDTH = 30

export function ProjectBreakdown({ projects }: ProjectBreakdownProps) {
  if (!projects || projects.length === 0) {
    return <Text color="gray">No project data</Text>
  }

  const maxCost = Math.max(...projects.map(p => p.totalCostUsd), 0.001)
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>BY PROJECT</Text>
      <Text color="gray">{'─'.repeat(90)}</Text>
      {projects.map((p) => {
        const barLen = Math.round((p.totalCostUsd / maxCost) * BAR_WIDTH)
        const bar = '█'.repeat(barLen) + '░'.repeat(BAR_WIDTH - barLen)

        return (
          <Box key={p.projectName}>
            <Text color="cyan" bold>{p.projectName.slice(0, 20).padEnd(21)}</Text>
            <Text color="yellow">{bar}</Text>
            <Text color="yellow">  ${p.totalCostUsd.toFixed(2).padStart(7)}</Text>
            <Text color="gray">  {p.sessionCount.toString().padStart(3)} sessions</Text>
            <Text color="gray">  {fmt(p.totalTokens).padStart(8)} tokens</Text>
          </Box>
        )
      })}
    </Box>
  )
}
