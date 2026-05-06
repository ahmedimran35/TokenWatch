import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'
import { AnalyticsEngine } from '@tokenwatch/engine'
import { Database } from '@tokenwatch/collector'
import { WebSocketManager } from './websocket'
import { LiveBroadcaster } from './live-broadcaster'
 import { requireAuth } from './auth'
 import logger from './logger'

import { createStatsRouter } from './routes/stats'
import { createProjectsRouter } from './routes/projects'
import { createSessionsRouter } from './routes/sessions'
import { createModelsRouter } from './routes/models'
import { createCacheRouter } from './routes/cache'
import { createAlertsRouter } from './routes/alerts'
import { createExportRouter } from './routes/export'
import { createTeamRouter } from './routes/team'
import { createToolRoutes } from './routes/tools'

interface ApiServerOptions {
  port?: number
  db: Database
  engine: AnalyticsEngine
  authToken?: string
  tlsCert?: string
  tlsKey?: string
}

interface ConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateConfig(options: ApiServerOptions): ConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!options.db) {
    errors.push('Database instance is required')
  }

  if (!options.engine) {
    errors.push('AnalyticsEngine instance is required')
  }

  const authToken = options.authToken || process.env.TOKENWATCH_AUTH_TOKEN
  if (!authToken && process.env.TOKENWATCH_ALLOW_ANONYMOUS !== 'true') {
    errors.push('TOKENWATCH_AUTH_TOKEN is required unless TOKENWATCH_ALLOW_ANONYMOUS=true is set')
  }

  if (process.env.TOKENWATCH_CORS_ORIGINS === '*') {
    errors.push('TOKENWATCH_CORS_ORIGINS cannot be "*" in production. Specify explicit origins.')
  }

  const rateLimitMax = parseInt(process.env.TOKENWATCH_RATE_LIMIT || '200', 10)
  if (isNaN(rateLimitMax) || rateLimitMax < 10) {
    errors.push('TOKENWATCH_RATE_LIMIT must be a positive integer >= 10')
  }

  const wsMaxClients = parseInt(process.env.TOKENWATCH_WS_MAX_CLIENTS || '10', 10)
  if (isNaN(wsMaxClients) || wsMaxClients < 1) {
    errors.push('TOKENWATCH_WS_MAX_CLIENTS must be a positive integer >= 1')
  }

  if (options.tlsCert && !options.tlsKey) {
    errors.push('TOKENWATCH_TLS_KEY is required when TOKENWATCH_TLS_CERT is set')
  }
  if (options.tlsKey && !options.tlsCert) {
    errors.push('TOKENWATCH_TLS_CERT is required when TOKENWATCH_TLS_KEY is set')
  }

  const tlsCert = options.tlsCert || process.env.TOKENWATCH_TLS_CERT
  const tlsKey = options.tlsKey || process.env.TOKENWATCH_TLS_KEY
  if (tlsCert && !fs.existsSync(tlsCert)) {
    errors.push(`TLS certificate file not found: ${tlsCert}`)
  }
  if (tlsKey && !fs.existsSync(tlsKey)) {
    errors.push(`TLS key file not found: ${tlsKey}`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

export class ApiServer {
  private app: express.Application
  private server?: http.Server | https.Server
  private wsManager: WebSocketManager
  private broadcaster?: LiveBroadcaster
  private shuttingDown = false
  private maintenanceInterval?: NodeJS.Timeout
  private backupInterval?: NodeJS.Timeout

  constructor(
    private options: ApiServerOptions
  ) {
    this.app = express()
    this.wsManager = new WebSocketManager()
  }

  async start(): Promise<void> {
    const validation = validateConfig(this.options)

    if (!validation.valid) {
      logger.fatal({ errors: validation.errors }, 'Configuration validation failed')
      for (const err of validation.errors) {
        logger.error({ err }, 'Configuration error')
      }
      throw new Error('Invalid configuration')
    }

    for (const warning of validation.warnings) {
      logger.warn({ warning }, 'Configuration warning')
    }

    const port = this.options.port ?? 57821
    const corsOrigins = process.env.TOKENWATCH_CORS_ORIGINS
      ? process.env.TOKENWATCH_CORS_ORIGINS.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://localhost:3000']
     const rateLimitMax = parseInt(process.env.TOKENWATCH_RATE_LIMIT || '200', 10) || 200
     const exportRateLimitMax = parseInt(process.env.TOKENWATCH_RATE_LIMIT_EXPORT || '50', 10) || 50

     logger.info({ port, corsOrigins, rateLimitMax }, 'Starting API server')

     this.app.use(
       helmet({
         contentSecurityPolicy: {
           directives: {
             defaultSrc: ["'self'"],
             scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
             styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
             fontSrc: ["'self'", "https://fonts.gstatic.com"],
             connectSrc: ["'self'", "ws:", "wss:"],
             imgSrc: ["'self'", "data:"],
           },
         },
       })
     )
     this.app.use(cors({ origin: corsOrigins }))
     this.app.use(express.json())

    const authToken = this.options.authToken || process.env.TOKENWATCH_AUTH_TOKEN
    const requireAuthExplicitly = process.env.TOKENWATCH_ALLOW_ANONYMOUS === 'true'
    const wsMaxClients = parseInt(process.env.TOKENWATCH_WS_MAX_CLIENTS || '10', 10) || 10

    this.wsManager = new WebSocketManager({ authToken: authToken || undefined, maxClients: wsMaxClients })

     const authMiddleware = requireAuthExplicitly
       ? (_req: any, _res: any, next: any) => next()
       : authToken
         ? requireAuth(authToken)
         : (_req: any, res: any, _next: any) => res.status(401).json({
             error: 'Authentication required. Set TOKENWATCH_AUTH_TOKEN environment variable or pass authToken to ApiServer.',
           })

     // Rate limiters
     const standardLimiter = rateLimit({
       windowMs: 60 * 1000,
       max: rateLimitMax,
       standardHeaders: true,
       legacyHeaders: false,
     })

     const exportLimiter = rateLimit({
       windowMs: 60 * 1000,
       max: exportRateLimitMax,
       standardHeaders: true,
       legacyHeaders: false,
     })

     const strictLimiter = rateLimit({
       windowMs: 60 * 1000,
       max: Math.min(rateLimitMax, 100),
       standardHeaders: true,
       legacyHeaders: false,
     })

     // Health check (no auth required, excluded from rate limiting)
     this.app.get('/api/health', (_req, res) => {
       let dbStatus = 'unknown'
       try {
         this.options.db.getDatabase().prepare('SELECT 1').get()
         dbStatus = 'ok'
       } catch {
         dbStatus = 'error'
       }

       const status = dbStatus === 'ok' ? 'ok' : 'degraded'
       res.status(status === 'ok' ? 200 : 503).json({
         status,
         uptime: process.uptime(),
         database: dbStatus,
         timestamp: new Date().toISOString(),
       })
     })

     this.app.use('/api/stats', authMiddleware, standardLimiter, createStatsRouter(this.options.engine, this.options.db))
     this.app.use('/api/projects', authMiddleware, standardLimiter, createProjectsRouter(this.options.db))
     this.app.use('/api/sessions', authMiddleware, standardLimiter, createSessionsRouter(this.options.db))
     this.app.use('/api/models', authMiddleware, standardLimiter, createModelsRouter(this.options.db))
     this.app.use('/api/cache', authMiddleware, standardLimiter, createCacheRouter(this.options.db))
     this.app.use('/api/alerts', authMiddleware, standardLimiter, createAlertsRouter(this.options.db))
     this.app.use('/api/export', authMiddleware, exportLimiter, createExportRouter(this.options.db))
     this.app.use('/api/tools', authMiddleware, strictLimiter, createToolRoutes(this.options.engine, this.options.db))

     const teamSecret = process.env.TOKENWATCH_TEAM_SECRET
     if (teamSecret) {
       this.app.use('/api/team', authMiddleware, standardLimiter, createTeamRouter(this.options.db, teamSecret))
     }

    // 404 handler - generic response
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' })
    })

     // Global error handler - suppress internal details
     this.app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
       if (err.type === 'entity.parse.failed' || err.status === 400) {
         return res.status(400).json({ error: 'Invalid request format' })
       }
       // Log only message internally, never send stack traces or file paths to client
       logger.error({ err: err.message || String(err) }, 'Unhandled API error')
       res.status(err.status || 500).json({ error: 'Internal server error' })
     })

    const tlsCert = this.options.tlsCert || process.env.TOKENWATCH_TLS_CERT
    const tlsKey = this.options.tlsKey || process.env.TOKENWATCH_TLS_KEY

     if (tlsCert && tlsKey) {
       this.server = https.createServer(
         {
           cert: fs.readFileSync(tlsCert),
           key: fs.readFileSync(tlsKey),
         },
         this.app
       )
       logger.info({ port, tls: true }, 'tokenwatch API running over HTTPS')
     } else {
       this.server = http.createServer(this.app)
       logger.info({ port, tls: false }, 'tokenwatch API running over HTTP')
     }

    this.wsManager.attach(this.server)

    this.broadcaster = new LiveBroadcaster(this.options.engine, this.wsManager)
    this.broadcaster.start()

    // Start maintenance tasks (WAL checkpoint + data retention)
    this.startMaintenanceTasks()

    // Graceful shutdown handlers
    const shutdown = () => this.gracefulShutdown()
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    return new Promise((resolve, reject) => {
      this.server!.listen(port, () => resolve())
      this.server!.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`))
        } else {
          reject(err)
        }
      })
    })
  }

  private startMaintenanceTasks(): void {
    const retentionDays = parseInt(process.env.TOKENWATCH_RETENTION_DAYS || '90', 10)
    const checkpointIntervalMs = parseInt(process.env.TOKENWATCH_WAL_CHECKPOINT_INTERVAL_MS || '3600000', 10)
    const retentionCheckIntervalMs = parseInt(process.env.TOKENWATCH_RETENTION_CHECK_INTERVAL_MS || '86400000', 10)
    const backupIntervalMs = parseInt(process.env.TOKENWATCH_BACKUP_INTERVAL_MS || '43200000', 10) // 12h

    logger.info(
      { retentionDays, checkpointIntervalMs, retentionCheckIntervalMs, backupIntervalMs },
      'Starting maintenance tasks'
    )

    this.maintenanceInterval = setInterval(() => {
      try {
        this.options.db.checkpointWal('PASSIVE')
      } catch (err) {
        logger.error({ err }, 'WAL checkpoint failed')
      }
    }, checkpointIntervalMs)

    const runRetentionCleanup = () => {
      try {
        this.options.db.cleanupOldEvents(retentionDays)
        logger.info({ retentionDays }, 'Retention cleanup completed')
      } catch (err) {
        logger.error({ err }, 'Retention cleanup failed')
      }
    }

    runRetentionCleanup()
    setInterval(runRetentionCleanup, retentionCheckIntervalMs)

     // Automated backups
     this.backupInterval = setInterval(() => {
       try {
         const backupPath = this.options.db.createBackup()
         logger.info({ backupPath }, 'Database backup created')
         // Prune old backups (keep 30 days)
         this.options.db.pruneOldBackups(30)
       } catch (err) {
         logger.error({ err }, 'Database backup failed')
       }
     }, backupIntervalMs)
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true

    logger.info('Shutting down API server...')

    const shutdownTimeout = setTimeout(() => {
      logger.fatal('Shutdown timeout exceeded, forcing exit')
      process.exit(1)
    }, 10000)

    try {
      // Stop maintenance tasks
      if (this.maintenanceInterval) {
        clearInterval(this.maintenanceInterval)
      }
      if (this.backupInterval) {
        clearInterval(this.backupInterval)
      }

      // Stop accepting new WebSocket connections
      this.broadcaster?.stop()
      this.wsManager.stop()

      // Drain HTTP connections
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => resolve())
        })
      }

      // Checkpoint WAL and close database
      try {
        const db = this.options.db.getDatabase()
        db.pragma('wal_checkpoint(TRUNCATE)')
      } catch {
        // ignore checkpoint errors during shutdown
      }
      this.options.db.close()

      clearTimeout(shutdownTimeout)
      logger.info('API server shut down complete')
      process.exit(0)
    } catch (err) {
      clearTimeout(shutdownTimeout)
      logger.error({ err }, 'Error during shutdown')
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    await this.gracefulShutdown()
  }
}
