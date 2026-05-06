import { Database } from '../database'
import type { TokenEvent, Session } from '@tokenwatch/types'

describe('Database', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('runs migrations on startup', () => {
    const internalDb = db.getDatabase()
    const tables = internalDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name)
    expect(tables).toContain('token_events')
    expect(tables).toContain('sessions')
    expect(tables).toContain('migrations')
  })

  it('inserts and retrieves events', () => {
    const event: TokenEvent = {
      id: 'evt-1',
      sessionId: 'sess-1',
      projectPath: '/Users/test/code',
      projectName: 'code',
      timestamp: new Date(),
      model: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 150,
      costUsd: 0.001,
      provider: 'claude',
    }

    db.insertEvent(event)
    expect(db.hasMessageId('evt-1')).toBe(true)
    expect(db.hasMessageId('evt-2')).toBe(false)
  })

  it('inserts and updates sessions', () => {
    const session: Session = {
      id: 'sess-1',
      projectPath: '/Users/test/code',
      projectName: 'code',
      provider: 'claude',
      startedAt: new Date(),
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 150,
      totalCostUsd: 0.001,
      eventCount: 1,
      modelsUsed: ['claude-sonnet-4-6'],
      toolsUsed: [],
    }

    db.insertOrUpdateSession(session)

    // Update same session
    const update: Session = {
      ...session,
      totalInputTokens: 200,
      totalOutputTokens: 100,
      totalTokens: 300,
      totalCostUsd: 0.002,
      eventCount: 1,
      modelsUsed: ['claude-sonnet-4-6'],
    }
    db.insertOrUpdateSession(update)

    const internalDb = db.getDatabase()
    const row = internalDb.prepare('SELECT * FROM sessions WHERE id = ?').get('sess-1') as any
    expect(row.total_input_tokens).toBe(300)
    expect(row.total_output_tokens).toBe(150)
    expect(row.event_count).toBe(2)
  })

  it('tracks watcher state', () => {
    db.setWatcherState('/some/file.jsonl', 1024)
    const state = db.getWatcherState('/some/file.jsonl')
    expect(state).not.toBeNull()
    expect(state!.lastPosition).toBe(1024)
  })
})
