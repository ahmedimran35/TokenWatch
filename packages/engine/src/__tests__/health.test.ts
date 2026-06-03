import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { getContextWasteReport, getZombieSessions, getSessionHealthScores } from '../health'
import type { Database as EngineDb } from '../database'

function createMockDb(): EngineDb {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE token_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project_path TEXT,
      project_name TEXT,
      timestamp TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      tool_name TEXT,
      tool_input TEXT,
      duration_ms INTEGER,
      provider TEXT DEFAULT 'claude'
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT,
      project_name TEXT,
      provider TEXT DEFAULT 'claude',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cache_read_tokens INTEGER DEFAULT 0,
      total_cache_write_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      event_count INTEGER DEFAULT 0,
      models_used TEXT DEFAULT '[]',
      tools_used TEXT DEFAULT '[]'
    );
  `)
  return { getDatabase: () => sqlite } as EngineDb
}

describe('getContextWasteReport', () => {
  it('returns zeros when no data', () => {
    const db = createMockDb()
    const result = getContextWasteReport(db, new Date('2020-01-01'), new Date('2020-12-31'))
    expect(result.totalInputTokens).toBe(0)
    expect(result.totalOutputTokens).toBe(0)
    expect(result.totalWastedTokens).toBe(0)
    expect(result.totalWastedCostUsd).toBe(0)
    expect(result.wastePercentage).toBe(0)
    expect(result.sessionsWithHighWaste).toEqual([])
  })

  it('calculates waste correctly when input exceeds output', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)`).run('1', 's1', '2024-01-01T00:00:00Z', 1000, 100, 0.01)
    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)`).run('2', 's1', '2024-01-01T00:00:01Z', 500, 200, 0.005)

    const result = getContextWasteReport(db, new Date('2024-01-01'), new Date('2024-01-02'))
    expect(result.totalInputTokens).toBe(1500)
    expect(result.totalOutputTokens).toBe(300)
    expect(result.totalWastedTokens).toBe(1200)
    expect(result.totalWastedCostUsd).toBeGreaterThan(0)
    expect(result.wastePercentage).toBe(80)
  })

  it('returns zero waste when output exceeds input', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)`).run('1', 's1', '2024-01-01T00:00:00Z', 100, 500, 0.01)

    const result = getContextWasteReport(db, new Date('2024-01-01'), new Date('2024-01-02'))
    expect(result.totalWastedTokens).toBe(0)
    expect(result.wastePercentage).toBe(0)
  })

  it('respected date range filter', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)`).run('1', 's1', '2023-01-01T00:00:00Z', 1000, 100, 0.01)
    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)`).run('2', 's1', '2024-06-01T00:00:00Z', 500, 50, 0.005)

    const result = getContextWasteReport(db, new Date('2024-01-01'), new Date('2024-12-31'))
    expect(result.totalInputTokens).toBe(500)
    expect(result.totalOutputTokens).toBe(50)
  })
})

describe('getZombieSessions', () => {
  it('returns empty when no open sessions', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    sqlite.prepare(`INSERT INTO sessions (id, started_at, ended_at) VALUES (?, ?, ?)`).run('s1', '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z')

    const result = getZombieSessions(db, 30)
    expect(result).toEqual([])
  })

  it('detects open session beyond threshold', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    sqlite.prepare(`INSERT INTO sessions (id, project_path, project_name, provider, started_at, total_input_tokens, total_output_tokens, total_cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('s1', '/test', 'test', 'claude', oldDate, 100, 200, 0.01)

    const result = getZombieSessions(db, 30)
    expect(result.length).toBe(1)
    expect(result[0].sessionId).toBe('s1')
    expect(result[0].idleMinutes).toBeGreaterThanOrEqual(55)
    expect(result[0].status).toBe('idle')
  })
})

describe('getSessionHealthScores', () => {
  it('returns empty when no sessions', () => {
    const db = createMockDb()
    const result = getSessionHealthScores(db, new Date('2020-01-01'), new Date('2020-12-31'))
    expect(result).toEqual([])
  })

  it('returns healthy scores for sessions with good ratio', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    sqlite.prepare(`INSERT INTO sessions (id, project_path, project_name, started_at, total_input_tokens, total_output_tokens, total_cost_usd, total_tokens, event_count, tools_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      's1', '/test', 'test', '2024-01-01T00:00:00Z', 1000, 2000, 0.01, 3000, 10, '["Read","Write","Bash"]'
    )

    const result = getSessionHealthScores(db, new Date('2024-01-01'), new Date('2024-01-02'))
    expect(result.length).toBe(1)
    expect(result[0].score).toBeGreaterThanOrEqual(70)
    expect(result[0].status).toBe('healthy')
  })

  it('flags stuck sessions with poor ratio', () => {
    const db = createMockDb()
    const sqlite = db.getDatabase() as Database.Database
    sqlite.prepare(`INSERT INTO sessions (id, project_path, project_name, started_at, total_input_tokens, total_output_tokens, total_cost_usd, total_tokens, event_count, tools_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      's1', '/test', 'test', '2024-01-01T00:00:00Z', 10000, 50, 0.08, 10050, 5, '["Read"]'
    )

    const result = getSessionHealthScores(db, new Date('2024-01-01'), new Date('2024-01-02'))
    expect(result.length).toBe(1)
    expect(result[0].score).toBeLessThan(40)
    expect(result[0].status).toBe('poor')
    expect(result[0].flags.some((f: string) => f.includes('output'))).toBe(true)
  })
})
