#!/usr/bin/env node

import { render } from 'ink'
import React from 'react'
import { startCollector } from '@tokenwatch/collector'
import App from './App'

async function main() {
  const { db } = await startCollector()
  const { waitUntilExit } = render(React.createElement(App, { db }), {
    exitOnCtrlC: true,
  })
  await waitUntilExit()
  db.close()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
