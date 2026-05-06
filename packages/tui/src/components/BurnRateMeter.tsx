import React from 'react'
import { Box, Text } from 'ink'

interface BurnRateMeterProps {
  tokensPerMinute: number
  costPerMinute: number
  costPerHour: number
  costPerDay: number
  sparkline?: number[]
}

const BLOCK_CHARS = ['░', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

export function BurnRateMeter({ tokensPerMinute, costPerMinute, costPerHour, costPerDay, sparkline = [] }: BurnRateMeterProps) {
  const maxVal = Math.max(...sparkline, 1)
  const sparklineStr = sparkline.slice(-60).map((v) => {
    const level = Math.min(8, Math.floor((v / maxVal) * 8))
    return BLOCK_CHARS[level]
  }).join('')

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray" bold>BURN RATE  </Text>
        <Text bold color={tokensPerMinute > 0 ? 'green' : 'gray'}>
          {tokensPerMinute.toLocaleString()} tokens/min
        </Text>
        <Text color="gray">  </Text>
        <Text color="yellow">
          ${costPerMinute.toFixed(4)}/min · ${costPerHour.toFixed(2)}/hr · ${costPerDay.toFixed(2)}/day
        </Text>
      </Box>
      {sparklineStr.length > 0 && (
        <Box>
          <Text color="green">{sparklineStr}</Text>
        </Box>
      )}
    </Box>
  )
}
