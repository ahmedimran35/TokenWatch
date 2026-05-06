import React from 'react'
import { Box, Text } from 'ink'
import Table from 'ink-table'

interface SessionsTableProps {
  sessions: Array<{
    projectName: string
    startedAt: string
    totalTokens: number
    totalCostUsd: number
    modelsUsed: string[]
  }>
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const data = sessions.slice(0, 5).map((s) => ({
    Project: s.projectName.slice(0, 20),
    Started: s.startedAt.slice(5, 16),
    Tokens: s.totalTokens.toLocaleString(),
    Cost: `$${s.totalCostUsd.toFixed(4)}`,
    Model: s.modelsUsed[0]?.slice(0, 15) || '-',
  }))

  if (data.length === 0) {
    return <Text color="gray">No sessions</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>TOP SESSIONS</Text>
      <Table data={data} />
    </Box>
  )
}