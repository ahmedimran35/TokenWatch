#!/usr/bin/env node

const { startApi } = require('./dist/src/index.js')

async function main() {
  console.log('Starting tokenwatch API server...')
  await startApi({
    port: 57821,
    onReady: (port) => {
      console.log(`API server running on http://localhost:${port}`)
    }
  })
}

main().catch(console.error)