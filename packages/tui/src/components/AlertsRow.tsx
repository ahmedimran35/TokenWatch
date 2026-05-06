import React from 'react'
import { Box, Text } from 'ink'

interface AlertsRowProps {
  alerts: Array<{ id: string; type: string; message: string }>
}

export function AlertsRow({ alerts }: AlertsRowProps) {
  if (alerts.length === 0) {
    return <Text color="gray">No alerts</Text>
  }

  return (
    <Box flexDirection="column">
      {alerts.map((a) => (
        <Text key={a.id} color="red">⚠ {a.message}</Text>
      ))}
    </Box>
  )
}