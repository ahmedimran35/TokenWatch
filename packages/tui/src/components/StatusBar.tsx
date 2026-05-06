import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
  version: string
}

export function StatusBar({ version }: StatusBarProps) {
  return (
    <Box>
      <Text color="gray">
        tokenwatch v{version}  |  ~/.tokenwatch/data.db  |  Watching: ~/.claude/projects/  |  Press q to quit
      </Text>
    </Box>
  )
}