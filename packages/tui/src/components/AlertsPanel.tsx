import React from 'react'
import { Box, Text } from 'ink'
import { Database } from '@tokenwatch/collector'

interface AlertsPanelProps {
  db: Database
}

export function AlertsPanel({ db }: AlertsPanelProps) {
  const alerts = (db as any).alerts || []
  const unacked = alerts.filter((a: any) => !a.acknowledged).slice(0, 10)

  if (unacked.length === 0) {
    return <Text color="green">No active alerts</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>ALERTS</Text>
      <Text color="gray">{'─'.repeat(70)}</Text>
      {unacked.map((a: any) => (
        <Box key={a.id} flexDirection="column" marginY={1}>
          <Text color="red" bold>[ALERT] {a.type}</Text>
          <Text color="gray">  {a.message}</Text>
          <Text color="gray">  Threshold: {a.threshold} | Current: {a.currentValue}</Text>
        </Box>
      ))}
    </Box>
  )
}
