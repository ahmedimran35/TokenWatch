"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
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
];
class Database {
    db;
    constructor(dbPath) {
        const dataDir = path.join(os.homedir(), '.tokenwatch');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const fullPath = dbPath ?? path.join(dataDir, 'data.db');
        this.db = new better_sqlite3_1.default(fullPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('foreign_keys = ON');
        this.runMigrations();
    }
    runMigrations() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);
        const appliedVersions = new Set(this.db.prepare('SELECT version FROM migrations').all().map((r) => r.version));
        for (const migration of MIGRATIONS) {
            if (!appliedVersions.has(migration.version)) {
                this.db.exec(migration.sql);
                this.db
                    .prepare('INSERT INTO migrations (version, applied_at) VALUES (?, datetime("now"))')
                    .run(migration.version);
            }
        }
    }
    insertEvent(event) {
        const stmt = this.db.prepare(`
      INSERT INTO token_events (
        id, session_id, project_path, project_name, timestamp, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        total_tokens, cost_usd, tool_name, tool_input, duration_ms, provider, raw_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(event.id, event.sessionId, event.projectPath, event.projectName, event.timestamp.toISOString(), event.model, event.inputTokens, event.outputTokens, event.cacheReadTokens, event.cacheWriteTokens, event.totalTokens, event.costUsd, event.toolName ?? null, event.toolInput ?? null, event.durationMs ?? null, event.provider, event.id // raw_message_id fallback to our generated id
        );
    }
    insertOrUpdateSession(session) {
        const existing = this.db
            .prepare('SELECT * FROM sessions WHERE id = ?')
            .get(session.id);
        if (!existing) {
            const stmt = this.db.prepare(`
        INSERT INTO sessions (
          id, project_path, project_name, provider, started_at, ended_at,
          total_input_tokens, total_output_tokens, total_cache_read_tokens, total_cache_write_tokens,
          total_tokens, total_cost_usd, event_count, models_used, tools_used, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
            stmt.run(session.id, session.projectPath, session.projectName, session.provider, session.startedAt.toISOString(), session.endedAt?.toISOString() ?? null, session.totalInputTokens, session.totalOutputTokens, session.totalCacheReadTokens, session.totalCacheWriteTokens, session.totalTokens, session.totalCostUsd, session.eventCount, JSON.stringify(session.modelsUsed), JSON.stringify(session.toolsUsed));
        }
        else {
            const modelsUsed = new Set(JSON.parse(existing.models_used));
            session.modelsUsed.forEach((m) => modelsUsed.add(m));
            const toolsUsed = new Set(JSON.parse(existing.tools_used));
            session.toolsUsed.forEach((t) => toolsUsed.add(t));
            const stmt = this.db.prepare(`
        UPDATE sessions SET
          ended_at = ?,
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
      `);
            stmt.run(session.endedAt?.toISOString() ?? existing.ended_at, session.totalInputTokens, session.totalOutputTokens, session.totalCacheReadTokens, session.totalCacheWriteTokens, session.totalTokens, session.totalCostUsd, session.eventCount, JSON.stringify(Array.from(modelsUsed)), JSON.stringify(Array.from(toolsUsed)), session.id);
        }
    }
    hasMessageId(rawMessageId) {
        const row = this.db.prepare('SELECT 1 FROM token_events WHERE raw_message_id = ?').get(rawMessageId);
        return !!row;
    }
    getWatcherState(filePath) {
        const row = this.db.prepare('SELECT last_position FROM watcher_state WHERE file_path = ?').get(filePath);
        if (!row)
            return null;
        return { lastPosition: row.last_position };
    }
    setWatcherState(filePath, position) {
        const stmt = this.db.prepare(`
      INSERT INTO watcher_state (file_path, last_position, last_seen_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(file_path) DO UPDATE SET
        last_position = excluded.last_position,
        last_seen_at = excluded.last_seen_at
    `);
        stmt.run(filePath, position);
    }
    getDatabase() {
        return this.db;
    }
    close() {
        this.db.close();
    }
}
exports.Database = Database;
//# sourceMappingURL=database.js.map