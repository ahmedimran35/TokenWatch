import { Router } from 'express'
import { Database } from '@tokenwatch/collector'

function safeDate(val: string | undefined, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  return isNaN(d.getTime()) ? fallback : d
}

export function createExportRouter(db: Database): Router {
  const router = Router()

  router.get('/csv', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())

    let whereClause = 'WHERE timestamp >= ? AND timestamp <= ?'
    const params: any[] = [from.toISOString(), to.toISOString()]

    if (req.query.provider) {
      whereClause += ' AND provider = ?'
      params.push(req.query.provider as string)
    }

    const rows = db
      .getDatabase()
      .prepare(
        `SELECT * FROM token_events ${whereClause} ORDER BY timestamp`
      )
      .all(...params) as any[]

    const headers = [
      'id', 'session_id', 'project_path', 'project_name', 'timestamp', 'model',
      'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens',
      'total_tokens', 'cost_usd', 'tool_name', 'provider'
    ]

    let csv = headers.join(',') + '\n'
    for (const row of rows) {
      csv += headers.map((h) => JSON.stringify(row[h] ?? '')).join(',') + '\n'
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=tokenwatch-export.csv')
    res.send(csv)
  })

  router.get('/json', (req, res) => {
    const from = safeDate(req.query.from as string, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const to = safeDate(req.query.to as string, new Date())

    const rows = db
      .getDatabase()
      .prepare(
        `SELECT * FROM token_events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp`
      )
      .all(from.toISOString(), to.toISOString())

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', 'attachment; filename=tokenwatch-export.json')
    res.json({ events: rows })
  })

  return router
}
