import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { evaluateAlerts, loadAlertConfig, saveAlertConfig } from '../alert-evaluator'
import type { AlertConfig } from '@tokenwatch/types'
import type { Database as EngineDb } from '../database'
import * as notifier from '../notifier'

function createMockDb(): EngineDb {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE token_events (
      id TEXT PRIMARY KEY, session_id TEXT, timestamp TEXT,
      input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0, cost_usd REAL DEFAULT 0,
      provider TEXT DEFAULT 'claude', model TEXT
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, project_path TEXT, project_name TEXT,
      started_at TEXT, ended_at TEXT, total_cost_usd REAL DEFAULT 0,
      total_tokens INTEGER DEFAULT 0, event_count INTEGER DEFAULT 0
    );
    CREATE TABLE alert_events (
      id TEXT PRIMARY KEY, type TEXT, threshold REAL, current_value REAL,
      triggered_at TEXT, acknowledged INTEGER DEFAULT 0, message TEXT
    );
  `)
  return { getDatabase: () => sqlite } as EngineDb
}

describe('evaluateAlerts with notifications', () => {
  let db: EngineDb
  let sqlite: Database.Database

  beforeEach(() => {
    db = createMockDb()
    sqlite = db.getDatabase() as Database.Database
  })

  it('triggers daily budget alert and persists it', () => {
    const today = new Date().toISOString().slice(0, 10)
    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, cost_usd) VALUES (?, ?, ?, ?)`).run('e1', 's1', `${today}T00:00:00Z`, 15)

    const config: AlertConfig = { dailyBudgetUsd: 10 }
    const alerts = evaluateAlerts(db, config)

    expect(alerts.length).toBe(1)
    expect(alerts[0].type).toBe('budget_daily')
    expect(alerts[0].currentValue).toBe(15)
    expect(alerts[0].threshold).toBe(10)

    const saved = sqlite.prepare("SELECT * FROM alert_events WHERE type = 'budget_daily'").get() as any
    expect(saved).toBeTruthy()
    expect(saved.current_value).toBe(15)
  })

  it('does not duplicate same alert within 30 minutes', () => {
    const today = new Date().toISOString().slice(0, 10)
    const config: AlertConfig = { dailyBudgetUsd: 10 }

    sqlite.prepare(`INSERT INTO token_events (id, session_id, timestamp, cost_usd) VALUES (?, ?, ?, ?)`).run('e1', 's1', `${today}T00:00:00Z`, 15)
    const first = evaluateAlerts(db, config)
    expect(first.length).toBe(1)

    const second = evaluateAlerts(db, config)
    expect(second.length).toBe(0)
  })

  it('triggers session budget alert for active session', () => {
    sqlite.prepare(`INSERT INTO sessions (id, started_at, total_cost_usd) VALUES (?, ?, ?)`).run('active-session', new Date().toISOString(), 5)
    const config: AlertConfig = { sessionBudgetUsd: 3 }
    const alerts = evaluateAlerts(db, config)

    expect(alerts.length).toBe(1)
    expect(alerts[0].type).toBe('session_cost')
  })

  it('does not trigger session budget for ended sessions', () => {
    sqlite.prepare(`INSERT INTO sessions (id, started_at, ended_at, total_cost_usd) VALUES (?, ?, ?, ?)`).run('ended-session', '2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z', 100)
    const config: AlertConfig = { sessionBudgetUsd: 10 }
    const alerts = evaluateAlerts(db, config)
    expect(alerts.length).toBe(0)
  })
})
