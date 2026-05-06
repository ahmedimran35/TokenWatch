import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import SQLite from 'better-sqlite3'
import type { TokenEvent, Session } from '@tokenwatch/types'

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS token_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        project_path TEXT NOT NULL,
        project_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        tool_name TEXT,
        tool_input TEXT,
        duration_ms INTEGER,
        provider TEXT NOT NULL DEFAULT 'claude',
        raw_message_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS team_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        tool_name TEXT,
        provider TEXT NOT NULL DEFAULT 'claude',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_team_events_user ON team_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_team_events_timestamp ON team_events(timestamp);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        project_name TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'claude',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        total_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER NOT NULL DEFAULT 0,
        total_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        total_cache_write_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0,
        event_count INTEGER NOT NULL DEFAULT 0,
        models_used TEXT NOT NULL DEFAULT '[]',
        tools_used TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS alert_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        threshold REAL NOT NULL,
        current_value REAL NOT NULL,
        triggered_at TEXT NOT NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        message TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watcher_state (
        file_path TEXT PRIMARY KEY,
        last_position INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_session ON token_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON token_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_project ON token_events(project_path);
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    `,
  },
]

export class Database {
  private db: SQLite.Database
  private dbPath: string

  constructor(dbPath?: string) {
    const dataDir = path.join(os.homedir(), '.tokenwatch')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    }
    this.dbPath = dbPath ?? path.join(dataDir, 'data.db')
    this.db = new SQLite(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('foreign_keys = ON')
    this.runMigrations()
  }

  async init(): Promise<void> {
    return Promise.resolve()
  }

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `)
    const appliedVersions = new Set(
      this.db.prepare('SELECT version FROM migrations').all().map((r: any) => r.version)
    )
    for (const migration of MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        this.db.exec(migration.sql)
        this.db
          .prepare('INSERT INTO migrations (version, applied_at) VALUES (?, datetime("now"))')
          .run(migration.version)
      }
    }
  }

  insertEvent(event: TokenEvent): boolean {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO token_events (
        id, session_id, project_path, project_name, timestamp, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_tokens, cost_usd, tool_name, tool_input, duration_ms, provider, raw_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const ts = event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp
    const result = stmt.run(
      event.id,
      event.sessionId,
      event.projectPath,
      event.projectName,
      ts,
      event.model,
      event.inputTokens,
      event.outputTokens,
      event.cacheReadTokens,
      event.cacheWriteTokens,
      event.totalTokens,
      event.costUsd,
      event.toolName ?? null,
      event.toolInput ?? null,
      event.durationMs ?? null,
      event.provider,
      (event as any).rawMessageId ?? event.id
    )
    return result.changes > 0
  }

  insertOrUpdateSession(session: Session): void {
    const existing = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(session.id) as any

    if (!existing) {
      const stmt = this.db.prepare(`
        INSERT INTO sessions (
          id, project_path, project_name, provider, started_at, ended_at,
          total_input_tokens, total_output_tokens, total_cache_read_tokens, total_cache_write_tokens,
          total_tokens, total_cost_usd, event_count, models_used, tools_used, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      const startedAt = session.startedAt instanceof Date ? session.startedAt.toISOString() : session.startedAt
      const endedAt = session.endedAt instanceof Date ? session.endedAt?.toISOString() : session.endedAt
      stmt.run(
        session.id,
        session.projectPath,
        session.projectName,
        session.provider,
        startedAt,
        endedAt ?? null,
        session.totalInputTokens,
        session.totalOutputTokens,
        session.totalCacheReadTokens,
        session.totalCacheWriteTokens,
        session.totalTokens,
        session.totalCostUsd,
        session.eventCount,
        JSON.stringify(session.modelsUsed),
        JSON.stringify(session.toolsUsed)
      )
    } else {
      const modelsUsed = new Set(JSON.parse(existing.models_used))
      for (const m of session.modelsUsed) modelsUsed.add(m)
      const toolsUsed = new Set(JSON.parse(existing.tools_used))
      for (const t of session.toolsUsed) toolsUsed.add(t)

      const stmt = this.db.prepare(`
        UPDATE sessions SET
          ended_at = COALESCE(?, ended_at),
          total_input_tokens = total_input_tokens + ?,
          total_output_tokens = total_output_tokens + ?,
          total_cache_read_tokens = total_cache_read_tokens + ?,
          total_cache_write_tokens = total_cache_write_tokens + ?,
          total_tokens = total_tokens + ?,
          total_cost_usd = total_cost_usd + ?,
          event_count = event_count + ?,
          models_used = ?,
          tools_used = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `)
      const endedAt = session.endedAt instanceof Date ? session.endedAt?.toISOString() : session.endedAt
      stmt.run(
        endedAt ?? existing.ended_at,
        session.totalInputTokens,
        session.totalOutputTokens,
        session.totalCacheReadTokens,
        session.totalCacheWriteTokens,
        session.totalTokens,
        session.totalCostUsd,
        session.eventCount,
        JSON.stringify(Array.from(modelsUsed)),
        JSON.stringify(Array.from(toolsUsed)),
        session.id
      )
    }
  }

  hasMessageId(rawMessageId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM token_events WHERE raw_message_id = ?').get(rawMessageId)
    return !!row
  }

  getWatcherState(filePath: string): { lastPosition: number } | null {
    const row = this.db.prepare('SELECT last_position FROM watcher_state WHERE file_path = ?').get(filePath) as any
    if (!row) return null
    return { lastPosition: row.last_position }
  }

  setWatcherState(filePath: string, position: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO watcher_state (file_path, last_position, last_seen_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(file_path) DO UPDATE SET
        last_position = excluded.last_position,
        last_seen_at = excluded.last_seen_at
    `)
    stmt.run(filePath, position)
  }

  getDatabase(): SQLite.Database {
    return this.db
  }

  checkpointWal(mode: 'PASSIVE' | 'FULL' | 'TRUNCATE' = 'TRUNCATE'): void {
    this.db.pragma(`wal_checkpoint(${mode})`)
  }

  cleanupOldEvents(olderThanDays: number): void {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    this.db.prepare('DELETE FROM token_events WHERE timestamp < ?').run(cutoff)
    this.db.prepare('DELETE FROM sessions WHERE ended_at IS NOT NULL AND ended_at < ?').run(cutoff)
  }

   createBackup(backupDir?: string): string {
     const dir = backupDir ?? path.join(path.dirname(this.dbPath), 'backups')
     if (!fs.existsSync(dir)) {
       fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
     }

     const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
     const backupPath = path.join(dir, `data-${timestamp}.db`)

     this.checkpointWal('TRUNCATE')
     this.db.backup(backupPath)

     return backupPath
   }

   pruneOldBackups(keepDays: number = 30): void {
     const dir = path.join(path.dirname(this.dbPath), 'backups')
     if (!fs.existsSync(dir)) return

     const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
     const files = fs.readdirSync(dir).filter((f) => f.startsWith('data-') && f.endsWith('.db'))
     for (const file of files) {
       const filePath = path.join(dir, file)
       const stats = fs.statSync(filePath)
       if (stats.mtimeMs < cutoff) {
         fs.unlinkSync(filePath)
       }
     }
   }

   close(): void {
     this.db.close()
   }
}
