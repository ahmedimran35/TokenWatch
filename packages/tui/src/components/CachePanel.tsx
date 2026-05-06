import React from 'react'
import { Box, Text } from 'ink'
import { Database } from '@tokenwatch/collector'
import { getCacheStats } from '@tokenwatch/engine'

interface CachePanelProps {
  db: Database
  period: string
}

function getPeriodDates(period: string) {
  const now = new Date()
  let from: Date
  switch (period) {
    case 'today': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case '7d': from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
    case '30d': from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break
    default: from = new Date(0)
  }
  return { from, to: now }
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()

export function CachePanel({ db, period }: CachePanelProps) {
  const dates = getPeriodDates(period)
  const cache = getCacheStats(db, { from: dates.from, to: dates.to })
  const hitRate = cache?.hitRate || 0
  const savings = cache?.estimatedSavingsUsd || 0
  const cacheRead = cache?.totalCacheReads || 0
  const cacheWrite = cache?.totalCacheWrites || 0

  const barWidth = 40
  const hitBarLen = Math.round(hitRate * barWidth)
  const hitBar = '█'.repeat(hitBarLen) + '░'.repeat(barWidth - hitBarLen)

  return (
    <Box flexDirection="column">
      <Text color="gray" bold>CACHE STATS</Text>
      <Text color="gray">{'─'.repeat(60)}</Text>

      <Box>
        <Text color="gray">Hit rate:  </Text>
        <Text color={hitRate >= 0.8 ? 'green' : hitRate >= 0.5 ? 'yellow' : 'red'} bold>
          {(hitRate * 100).toFixed(1)}%
        </Text>
      </Box>

      <Box>
        <Text color="gray">[</Text>
        <Text color={hitRate >= 0.8 ? 'green' : hitRate >= 0.5 ? 'yellow' : 'red'}>{hitBar}</Text>
        <Text color="gray">]</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Cache read:   {fmt(cacheRead).padStart(8)} tokens</Text>
      </Box>
      <Box>
        <Text color="gray">Cache write:  {fmt(cacheWrite).padStart(8)} tokens</Text>
      </Box>
      <Box>
        <Text color="gray">Total cached: {fmt(cacheRead + cacheWrite).padStart(8)} tokens</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Est. savings: </Text>
        <Text color="green">${savings.toFixed(4)}</Text>
      </Box>

      {hitRate < 0.5 && (
        <Box marginTop={1}>
          <Text color="yellow">Low cache hit rate. Consider reducing context or using more consistent prompts.</Text>
        </Box>
      )}
    </Box>
  )
}
