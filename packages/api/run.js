const { startApi } = require('./dist/src/index.js')

const port = parseInt(process.env.TOKENWATCH_API_PORT || '57821', 10)

startApi({ port }).catch((err) => {
  console.error('Failed to start API:', err)
  process.exit(1)
})
