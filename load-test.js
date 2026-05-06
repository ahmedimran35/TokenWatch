#!/usr/bin/env node
/**
 * Simple load test for tokenwatch API
 * Usage: node load-test.js [concurrency] [requestsPerClient]
 */

import { parseArgs } from 'node:util'
import { homedir } from 'node:os'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgsToObject(argv) {
  const args = parseArgs({ values: { zero: 0, one: 1 }, strict: false }, { argv })
  return args
}

const args = parseArgsToObject(process.argv.slice(2))
const CONCURRENCY = args.c || args.concurrency || 10
const REQUESTS_PER_CLIENT = args.n || args.requests || 100
const API_URL = args.u || args.url || 'http://localhost:57821'
const AUTH_TOKEN = args.t || args.token || (() => {
  try {
    // Load from default config if present
    const configPath = path.join(homedir(), '.tokenwatch', 'config.json')
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return config.alerts?.token || null
    }
  } catch {}
  return null
})()

const endpoints = [
  '/api/health',
  '/api/stats/live',
  '/api/stats/overview?from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z',
  '/api/projects?from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&limit=10',
  '/api/sessions?from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&limit=10',
  '/api/models?from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z',
  '/api/cache/stats?from=2025-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z',
  '/api/alerts',
  '/api/stats/burn-rate-history?periodHours=24&bucketMinutes=5',
]

async function makeRequest(url) {
  const headers: Record<string, string> = {}
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
  }
  const res = await fetch(url, { headers })
  return { status: res.status, ok: res.ok }
}

async function runClient(clientId) {
  const errors = []
  const start = Date.now()
  for (let i = 0; i < REQUESTS_PER_CLIENT; i++) {
    const endpoint = endpoints[i % endpoints.length]
    const url = API_URL + endpoint
    try {
      const result = await makeRequest(url)
      if (!result.ok) {
        errors.push({ endpoint, status: result.status })
      }
    } catch (err) {
      errors.push({ endpoint, error: err.message })
    }
  }
  const duration = (Date.now() - start) / 1000
  return { clientId, duration, errors, requests: REQUESTS_PER_CLIENT }
}

async function runLoadTest() {
  console.log(`Load testing ${API_URL}`)
  console.log(`Concurrency: ${CONCURRENCY}, requests per client: ${REQUESTS_PER_CLIENT}`)
  console.log(`Total requests: ${CONCURRENCY * REQUESTS_PER_CLIENT}`)
  console.log('')

  const start = Date.now()
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => runClient(i + 1))
  )
  const totalTime = (Date.now() - start) / 1000

  let totalRequests = 0
  let totalErrors = 0
  let errorMap = new Map()

  for (const r of results) {
    totalRequests += r.requests
    totalErrors += r.errors.length
    for (const e of r.errors) {
      const key = e.status ? `HTTP ${e.status}` : e.error
      errorMap.set(key, (errorMap.get(key) ?? 0) + 1)
    }
  }

  console.log('')
  console.log('=== Load Test Results ===')
  console.log(`Duration: ${totalTime.toFixed(2)}s`)
  console.log(`Throughput: ${(totalRequests / totalTime).toFixed(2)} req/s`)
  console.log(`Total requests: ${totalRequests}`)
  console.log(`Total errors: ${totalErrors}`)
  if (totalErrors > 0) {
    console.log('Error breakdown:')
    for (const [err, count] of errorMap.entries()) {
      console.log(`  ${err}: ${count}`)
    }
  }
  console.log('')
  console.log('Per-client stats:')
  for (const r of results) {
    const rate = r.requests / r.duration
    console.log(`  Client ${r.clientId}: ${r.requests} req in ${r.duration.toFixed(2)}s (${rate.toFixed(2)} req/s, ${r.errors.length} errors)`)
  }
}

runLoadTest().catch(console.error)
