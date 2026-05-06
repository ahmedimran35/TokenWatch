import { Router } from 'express'
import * as path from 'path'
import { getProjectStats } from '@tokenwatch/engine'
import { Database } from '@tokenwatch/collector'

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

function sanitizeProjectPath(raw: string): string {
  const decoded = decodeURIComponent(raw.replace(/-/g, '/'))
  const resolved = path.resolve(decoded)
  const homeDir = path.resolve(process.env.HOME || '/')
  if (!resolved.startsWith(homeDir)) {
    throw new Error('Project path must be within home directory')
  }
  return resolved
}

export function createProjectsRouter(db: Database): Router {
  const router = Router()

  router.get('/', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20))
    res.json(getProjectStats(db, { from, to, limit }))
  })

  router.get('/:encodedPath/sessions', (req, res) => {
    try {
      const decodedPath = sanitizeProjectPath(req.params.encodedPath)
      const rows = db
        .getDatabase()
        .prepare('SELECT * FROM sessions WHERE project_path = ? ORDER BY started_at DESC')
        .all(decodedPath)
      res.json(rows.map(rowToSession))
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  return router
}

function rowToSession(r: any) {
  return {
    id: r.id,
    projectPath: r.project_path,
    projectName: r.project_name,
    provider: r.provider,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    totalInputTokens: r.total_input_tokens,
    totalOutputTokens: r.total_output_tokens,
    totalCacheReadTokens: r.total_cache_read_tokens,
    totalCacheWriteTokens: r.total_cache_write_tokens,
    totalTokens: r.total_tokens,
    totalCostUsd: r.total_cost_usd,
    eventCount: r.event_count,
    modelsUsed: JSON.parse(r.models_used),
    toolsUsed: JSON.parse(r.tools_used),
  }
}
