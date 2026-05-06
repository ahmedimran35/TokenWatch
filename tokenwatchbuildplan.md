# tokenwatch — Complete Build Plan
### Claude Code Prompts: Phase 0 → Phase 8

> A better-than-codeburn open-source token analytics platform for Claude Code.
> Every prompt below is copy-paste ready for Claude Code.

---

## Overview

| Phase | Name | What gets built |
|-------|------|-----------------|
| 0 | Monorepo scaffold | pnpm workspace, TypeScript, tooling |
| 1 | Log collector | JSONL watcher, parser, SQLite schema |
| 2 | Analytics engine | Burn rate, cost, session aggregation |
| 3 | REST + WebSocket API | Express server, live streaming |
| 4 | Web dashboard | React + Vite, real-time charts |
| 5 | Terminal UI | Ink-based live TUI |
| 6 | VS Code extension | Status bar token meter |
| 7 | Team mode | Multi-user server, shared budgets |
| 8 | CI/CD + GitHub Actions | PR cost comments, pipeline integration |

---

## Phase 0 — Monorepo Scaffold

### What this phase delivers
- pnpm workspace with 6 packages
- TypeScript configured across all packages
- Shared ESLint + Prettier config
- Shared type definitions
- MIT license, README, CHANGELOG
- Git hooks with husky + lint-staged

### Claude Code Prompt

```
Create a monorepo called tokenwatch. Use pnpm workspaces.

Root structure:
tokenwatch/
  packages/
    collector/       # JSONL log watcher and parser
    engine/          # Analytics calculations
    api/             # Express + WebSocket server
    web/             # React + Vite dashboard
    tui/             # Ink terminal UI
    vscode/          # VS Code extension
  shared/
    types/           # Shared TypeScript types
    utils/           # Shared utility functions
  .github/
    workflows/       # CI/CD pipelines

Root package.json requirements:
- name: "tokenwatch"
- private: true
- engines: { node: ">=20" }
- scripts:
    dev: "pnpm -r --parallel run dev"
    build: "pnpm -r run build"
    test: "pnpm -r run test"
    lint: "eslint packages/**/src --ext .ts,.tsx"
    typecheck: "pnpm -r run typecheck"
    clean: "pnpm -r run clean"

pnpm-workspace.yaml:
- packages: ["packages/*", "shared/*"]

Root tsconfig.json (base):
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}

Each package needs its own tsconfig.json that extends the root.

shared/types/src/index.ts — define these interfaces:

export interface TokenEvent {
  id: string                    // UUID v4
  sessionId: string
  projectPath: string
  projectName: string           // basename of projectPath
  timestamp: Date
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number           // computed: input + output + cacheRead + cacheWrite
  costUsd: number
  toolName?: string
  toolInput?: string
  durationMs?: number
  provider: 'claude' | 'codex' | 'cursor' | 'opencode'
}

export interface Session {
  id: string
  projectPath: string
  projectName: string
  provider: string
  startedAt: Date
  endedAt?: Date
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalTokens: number
  totalCostUsd: number
  eventCount: number
  modelsUsed: string[]
  toolsUsed: string[]
}

export interface BurnRate {
  tokensPerMinute: number
  tokensPerHour: number
  tokensPerDay: number
  costPerMinute: number
  costPerHour: number
  costPerDay: number
  windowMinutes: number         // rolling window used for calculation
  sampledAt: Date
}

export interface DailyStats {
  date: string                  // YYYY-MM-DD
  totalTokens: number
  totalCostUsd: number
  sessionCount: number
  topModel: string
  topProject: string
}

export interface ProjectStats {
  projectName: string
  projectPath: string
  totalTokens: number
  totalCostUsd: number
  sessionCount: number
  avgCostPerSession: number
  lastActiveAt: Date
}

export interface ModelStats {
  model: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  totalCostUsd: number
  callCount: number
  avgCostPerCall: number
}

export interface Alert {
  id: string
  type: 'budget_daily' | 'budget_hourly' | 'burn_rate_spike' | 'session_cost'
  threshold: number
  currentValue: number
  triggeredAt: Date
  acknowledged: boolean
  message: string
}

export interface AlertConfig {
  dailyBudgetUsd?: number
  hourlyBudgetUsd?: number
  burnRateSpikeMultiplier?: number   // alert if burn rate is X times the 7-day average
  sessionBudgetUsd?: number
  slackWebhookUrl?: string
  webhookUrl?: string
  emailAddress?: string
}

export interface LiveStats {
  burnRate: BurnRate
  todayCost: number
  todayTokens: number
  monthCost: number
  monthTokens: number
  activeSession?: Session
  recentEvents: TokenEvent[]   // last 20 events
  alerts: Alert[]
}

Install these root devDependencies:
- typescript@^5
- @typescript-eslint/eslint-plugin@^7
- @typescript-eslint/parser@^7
- eslint@^8
- prettier@^3
- husky@^9
- lint-staged@^15

Create .eslintrc.json, .prettierrc, .gitignore, LICENSE (MIT), README.md, CHANGELOG.md.

README.md should explain what tokenwatch is, why it's better than codeburn, and how to install/run it.

Run `pnpm install` after creating all files to verify the workspace resolves correctly.
```

---

## Phase 1 — Log Collector

### What this phase delivers
- File system watcher for `~/.claude/projects/**/*.jsonl`
- JSONL line parser with full field extraction
- Message deduplication (by message ID)
- SQLite database with complete schema
- Database migration system
- Graceful shutdown and error recovery

### Claude Code Prompt

```
Build the collector package at packages/collector.

This package watches Claude Code's log files and stores parsed events in SQLite.

Dependencies to install in packages/collector:
- better-sqlite3@^9
- @types/better-sqlite3@^7
- chokidar@^3
- uuid@^9
- @types/uuid@^9
- zod@^3 (for runtime validation of JSONL lines)

File structure to create:
packages/collector/src/
  index.ts          # public API exports
  watcher.ts        # file system watcher
  parser.ts         # JSONL line parser
  database.ts       # SQLite wrapper and migrations
  deduplicator.ts   # message ID dedup logic
  pricing.ts        # token cost calculator
  types.ts          # internal types

----

packages/collector/src/database.ts

Create a Database class that:

1. Opens SQLite at: path.join(os.homedir(), '.tokenwatch', 'data.db')
   Creates the directory if it doesn't exist.

2. Enables WAL mode: PRAGMA journal_mode=WAL
   Also set: PRAGMA synchronous=NORMAL, PRAGMA foreign_keys=ON

3. Runs migrations on every startup. Migrations are versioned SQL strings
   in an array. Track applied migrations in a `migrations` table:
   CREATE TABLE IF NOT EXISTS migrations (
     version INTEGER PRIMARY KEY,
     applied_at TEXT NOT NULL
   )
   Apply any migration whose version is not yet in that table.

4. Migration 1 — create these tables:

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
  raw_message_id TEXT UNIQUE,    -- used for deduplication
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  models_used TEXT NOT NULL DEFAULT '[]',    -- JSON array
  tools_used TEXT NOT NULL DEFAULT '[]',     -- JSON array
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
  last_position INTEGER NOT NULL DEFAULT 0,    -- byte offset for tail
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON token_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON token_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project ON token_events(project_path);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

5. Expose these methods:
   - insertEvent(event: TokenEvent): void
   - insertOrUpdateSession(session: Session): void
   - hasMessageId(rawMessageId: string): boolean
   - getWatcherState(filePath: string): { lastPosition: number } | null
   - setWatcherState(filePath: string, position: number): void
   - close(): void

----

packages/collector/src/pricing.ts

Create a pricing calculator with current Anthropic pricing (May 2026):

const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-4-5':          { input: 15,    output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-sonnet-4-5':        { input: 3,     output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-haiku-4-5':         { input: 0.80,  output: 4,    cacheRead: 0.08,  cacheWrite: 1     },
  'claude-opus-4-6':          { input: 15,    output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-sonnet-4-6':        { input: 3,     output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
}
// All prices are per 1 million tokens.

Export: calculateCost(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number
- Look up the model. If not found, try prefix matching (e.g. "claude-sonnet" matches "claude-sonnet-4-6").
- Return total cost in USD.

----

packages/collector/src/parser.ts

Create a JSONL line parser.

Claude Code log format (each line is JSON):
{
  "type": "assistant",
  "message": {
    "id": "msg_...",
    "model": "claude-sonnet-4-6-...",
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 89,
      "cache_read_input_tokens": 45
    },
    "content": [
      { "type": "tool_use", "name": "Bash", "input": { "command": "ls" } },
      ...
    ]
  },
  "timestamp": "2026-05-04T10:30:00.000Z",
  "sessionId": "abc123",
  "costUSD": 0.00234,
  "durationMs": 1200
}

Create a Zod schema that validates this structure (all fields optional except type).

Export: parseLine(line: string, filePath: string): TokenEvent | null

Parsing logic:
- JSON.parse the line, catch errors and return null
- Validate with Zod, return null if invalid
- Only process lines where type === "assistant"
- Extract message.id as rawMessageId
- Extract sessionId from the root
- Derive projectPath from filePath:
    ~/.claude/projects/<encoded-path>/<session>.jsonl
    The <encoded-path> uses '-' as path separator — convert back to '/'
    e.g. "-Users-john-code-myapp" → "/Users/john/code/myapp"
- Extract model from message.model
- Extract token counts from message.usage
- Extract first tool_use content block name as toolName (if any)
- Calculate costUsd using pricing.ts
- Generate a new UUID v4 as the event id
- Return a complete TokenEvent

----

packages/collector/src/watcher.ts

Create a CollectorWatcher class.

Constructor takes: { db: Database, onEvent?: (event: TokenEvent) => void }

Method: start()
- Watch directory: path.join(os.homedir(), '.claude', 'projects')
- Use chokidar with: { persistent: true, ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 200 } }
- Watch pattern: **/*.jsonl
- On 'add' event: processFile(filePath) — read from beginning
- On 'change' event: processFile(filePath) — read from last position (tail)

Method: processFile(filePath: string)
- Get last byte position from db.getWatcherState(filePath) — default to 0
- Open file, seek to position, read new content
- Split on newlines, filter empty lines
- For each line: parseLine → check dedup → insertEvent → updateSession
- Update watcher state with new position
- Handle errors gracefully (file deleted, permission denied, etc.)

Method: stop()
- Close the chokidar watcher

Dedup logic:
- Before inserting, call db.hasMessageId(rawMessageId)
- Skip if already seen

Session tracking:
- After inserting an event, upsert the session:
  - If session doesn't exist: create it with this event's data
  - If exists: add tokens, update costs, merge modelsUsed/toolsUsed arrays, update ended_at

----

packages/collector/src/index.ts

Export a simple start() function:

export async function startCollector(options?: {
  onEvent?: (event: TokenEvent) => void
  onError?: (error: Error) => void
}) {
  const db = new Database()
  const watcher = new CollectorWatcher({ db, onEvent: options?.onEvent })
  await watcher.start()

  process.on('SIGINT', () => { watcher.stop(); db.close(); process.exit(0) })
  process.on('SIGTERM', () => { watcher.stop(); db.close(); process.exit(0) })

  return { db, watcher }
}

----

Write comprehensive tests in packages/collector/src/__tests__/:
- parser.test.ts: test parseLine with valid/invalid/edge case inputs
- database.test.ts: test migrations run, insert/query work, dedup works
- pricing.test.ts: test cost calculations for each known model

Use Jest. Add jest.config.js and install jest, ts-jest, @types/jest.
```

---

## Phase 2 — Analytics Engine

### What this phase delivers
- Rolling burn rate calculation (1min, 5min, 15min, 1hr windows)
- Cost aggregation by day / week / month / all time
- Per-project and per-model breakdowns
- Session ranking (most expensive, longest, most tokens)
- Cache hit rate calculation
- Anomaly detection (burn rate spike detection)
- Alert trigger evaluation

### Claude Code Prompt

```
Build the analytics engine at packages/engine.

This package reads from the SQLite database written by the collector
and computes all metrics. It never writes to the database directly
except to insert alerts.

Dependencies:
- better-sqlite3@^9
- @types/better-sqlite3@^7
- @tokenwatch/types (workspace:*)

File structure:
packages/engine/src/
  index.ts
  burn-rate.ts
  aggregator.ts
  project-stats.ts
  model-stats.ts
  session-ranker.ts
  alert-evaluator.ts
  cache-stats.ts
  query-builder.ts   # reusable SQL helpers

----

packages/engine/src/burn-rate.ts

Export: calculateBurnRate(db: Database, windowMinutes: number = 5): BurnRate

Implementation:
- Query token_events WHERE timestamp >= now - windowMinutes
- Sum total_tokens and cost_usd
- Extrapolate to per-minute, per-hour, per-day rates
- Handle edge case: if no events in window, return zeros
- Return BurnRate object

Export: getBurnRateHistory(db: Database, periodHours: number, bucketMinutes: number): Array<{
  bucketStart: Date
  tokensPerMinute: number
  costPerMinute: number
}>
- Creates a time-series of burn rate over the last `periodHours`
- Each bucket is `bucketMinutes` wide
- Used to render the burn rate sparkline chart

----

packages/engine/src/aggregator.ts

Export: getStats(db: Database, options: {
  from: Date
  to: Date
  projectPath?: string
  provider?: string
}): {
  totalTokens: number
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  cacheHitRate: number          // cacheReadTokens / (inputTokens + cacheReadTokens)
  sessionCount: number
  avgCostPerSession: number
  avgTokensPerSession: number
  dailyBreakdown: DailyStats[]
}

Export helper presets:
- getToday(db): calls getStats with today's date range
- getThisWeek(db): last 7 days
- getThisMonth(db): this calendar month
- getLast30Days(db): rolling 30 days
- getAllTime(db): no date filter

----

packages/engine/src/project-stats.ts

Export: getProjectStats(db: Database, options: { from: Date; to: Date; limit?: number }): ProjectStats[]

- Group token_events by project_name
- Sum tokens and costs
- Count distinct session IDs
- Compute avgCostPerSession
- Get max(timestamp) as lastActiveAt
- Sort by totalCostUsd DESC
- Apply limit (default 20)

----

packages/engine/src/model-stats.ts

Export: getModelStats(db: Database, options: { from: Date; to: Date }): ModelStats[]

- Group token_events by model
- Sum all token types and costs
- Count events as callCount
- Compute avgCostPerCall
- Sort by totalCostUsd DESC

----

packages/engine/src/session-ranker.ts

Export: getTopSessions(db: Database, options: {
  from: Date
  to: Date
  limit?: number
  sortBy?: 'cost' | 'tokens' | 'duration'
}): Session[]

- Join sessions with aggregated events
- Apply date filter
- Sort by the chosen field
- Return top N sessions (default 10)

Export: getSessionTimeline(db: Database, sessionId: string): TokenEvent[]
- Return all events for a session, ordered by timestamp ASC
- This enables the "session replay" / drill-down view

----

packages/engine/src/cache-stats.ts

Export: getCacheStats(db: Database, options: { from: Date; to: Date }): {
  hitRate: number
  totalCacheReads: number
  totalCacheWrites: number
  estimatedSavingsUsd: number    // cost if cacheReads had been inputTokens
  dailyHitRates: Array<{ date: string; hitRate: number }>
}

----

packages/engine/src/alert-evaluator.ts

This module evaluates whether any alert thresholds are breached.

Export: evaluateAlerts(db: Database, config: AlertConfig): Alert[]

Rules to check:
1. Daily budget: if today's cost >= config.dailyBudgetUsd, trigger alert
2. Hourly budget: if this hour's cost >= config.hourlyBudgetUsd, trigger alert
3. Burn rate spike: compare current 5-min burn rate to 7-day average.
   If current > average * config.burnRateSpikeMultiplier, trigger alert
4. Session budget: if the most recent open session cost >= config.sessionBudgetUsd, trigger

For each triggered alert:
- Check if same alert type was already triggered in last 30 minutes (avoid spam)
- If not, insert into alert_events table and return it

Export: loadAlertConfig(configPath?: string): AlertConfig
- Read from ~/.tokenwatch/config.json
- Return defaults if file doesn't exist:
  { dailyBudgetUsd: 10, burnRateSpikeMultiplier: 3 }

Export: saveAlertConfig(config: AlertConfig, configPath?: string): void

----

packages/engine/src/index.ts

Export a AnalyticsEngine class:

class AnalyticsEngine {
  constructor(db: Database) {}

  getLiveStats(): LiveStats {
    // Combines burn rate, today stats, recent events, active alerts
  }

  getStats(options: { from: Date; to: Date; ... }): DashboardData
  getProjectStats(options): ProjectStats[]
  getModelStats(options): ModelStats[]
  getTopSessions(options): Session[]
  getSessionTimeline(sessionId: string): TokenEvent[]
  getCacheStats(options): CacheStats
  getBurnRateHistory(periodHours, bucketMinutes): BurnRateHistory[]
  evaluateAlerts(): Alert[]
}

Also export all individual functions for tree-shaking.

----

Write tests for every exported function. Use real SQLite (in-memory mode):
const db = new Database(':memory:')
Insert seed data, verify calculations.

Test edge cases:
- Empty database returns zeros not NaN
- Single event returns correct rates
- Cache hit rate handles zero input tokens gracefully
- Alert dedup prevents spam (two evaluations within 30 min only produce one alert)
```

---

## Phase 3 — REST + WebSocket API

### What this phase delivers
- Express REST API with full CRUD for stats/config
- WebSocket server pushing live events
- Server-Sent Events (SSE) as WebSocket fallback
- CORS configured for local dev
- API key auth (optional, for team mode)
- OpenAPI/Swagger docs auto-generated
- Rate limiting

### Claude Code Prompt

```
Build the API server at packages/api.

Dependencies:
- express@^4
- @types/express@^4
- ws@^8
- @types/ws@^8
- cors@^2
- @types/cors@^2
- helmet@^7
- express-rate-limit@^7
- zod@^3
- swagger-ui-express@^5
- @types/swagger-ui-express@^4

Also import from workspace: @tokenwatch/types, @tokenwatch/engine, @tokenwatch/collector

----

packages/api/src/server.ts

Create an ApiServer class with:

constructor(options: {
  port?: number                  // default 57821
  db: Database
  engine: AnalyticsEngine
  authToken?: string             // if set, require Bearer token on all routes
})

Method: start(): Promise<void>
- Create Express app
- Apply helmet() for security headers
- Apply cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] })
- Apply express.json()
- Apply rate limiting: max 200 requests per minute per IP
- Register all routes (see below)
- Create HTTP server
- Attach WebSocket server to the same HTTP server
- Start listening

Method: stop(): Promise<void>
- Close WebSocket connections gracefully
- Close HTTP server

----

packages/api/src/routes/

Create these route files:

--- stats.ts ---
GET /api/stats/live
  Returns: LiveStats (burn rate, today cost, month cost, recent events, alerts)
  Calls: engine.getLiveStats()

GET /api/stats/overview
  Query params: from (ISO date), to (ISO date), projectPath?, provider?
  Returns: aggregated stats for the period
  Calls: engine.getStats(options)

GET /api/stats/daily
  Query params: from, to
  Returns: DailyStats[] — one entry per day
  
GET /api/stats/burn-rate-history
  Query params: periodHours (default 24), bucketMinutes (default 5)
  Returns: Array<{ bucketStart, tokensPerMinute, costPerMinute }>

--- projects.ts ---
GET /api/projects
  Query params: from, to, limit
  Returns: ProjectStats[]

GET /api/projects/:encodedPath/sessions
  Returns: all sessions for a project, newest first

--- sessions.ts ---
GET /api/sessions
  Query params: from, to, sortBy, limit
  Returns: Session[]

GET /api/sessions/:sessionId
  Returns: full Session with events array (timeline)

GET /api/sessions/:sessionId/events
  Returns: TokenEvent[] for session (for timeline replay)

--- models.ts ---
GET /api/models
  Query params: from, to
  Returns: ModelStats[]

--- cache.ts ---
GET /api/cache/stats
  Query params: from, to
  Returns: CacheStats with hit rate, savings estimate

--- alerts.ts ---
GET /api/alerts
  Returns: all Alert[] ordered by triggeredAt DESC

POST /api/alerts/:id/acknowledge
  Marks alert as acknowledged in database

GET /api/alerts/config
  Returns: current AlertConfig

PUT /api/alerts/config
  Body: AlertConfig
  Validates with Zod, saves to config file
  Returns: updated AlertConfig

--- export.ts ---
GET /api/export/csv
  Query params: from, to, provider?
  Returns: CSV download with all token events
  Set headers: Content-Type: text/csv, Content-Disposition: attachment; filename=tokenwatch-export.csv

GET /api/export/json
  Query params: from, to
  Returns: JSON download with complete dashboard data

----

packages/api/src/websocket.ts

Create a WebSocketManager class:

class WebSocketManager {
  private clients: Set<WebSocket> = new Set()
  private pingInterval?: NodeJS.Timeout

  attach(server: http.Server): void {
    const wss = new WebSocketServer({ server })
    
    wss.on('connection', (ws) => {
      this.clients.add(ws)
      
      // Send current live stats immediately on connect
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date() }))
      
      ws.on('close', () => this.clients.delete(ws))
      ws.on('error', () => this.clients.delete(ws))
      
      // Handle ping/pong for connection health
      ws.on('pong', () => { (ws as any).isAlive = true })
    })
    
    // Heartbeat: ping every 30s, close dead connections
    this.pingInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) { ws.terminate(); return }
        (ws as any).isAlive = false
        ws.ping()
      })
    }, 30000)
  }

  broadcast(event: {
    type: 'token_event' | 'session_update' | 'alert' | 'burn_rate_update'
    data: unknown
  }): void {
    const message = JSON.stringify(event)
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })
  }

  stop(): void {
    clearInterval(this.pingInterval)
  }
}

----

packages/api/src/live-broadcaster.ts

This module polls the engine every 5 seconds and broadcasts changes:

class LiveBroadcaster {
  constructor(private engine: AnalyticsEngine, private ws: WebSocketManager) {}

  start(): void {
    // Broadcast burn rate every 5 seconds
    setInterval(() => {
      const burnRate = this.engine.getBurnRate()
      this.ws.broadcast({ type: 'burn_rate_update', data: burnRate })
    }, 5000)
    
    // Check alerts every 30 seconds
    setInterval(() => {
      const newAlerts = this.engine.evaluateAlerts()
      newAlerts.forEach(alert => {
        this.ws.broadcast({ type: 'alert', data: alert })
      })
    }, 30000)
  }
}

The collector's onEvent callback should also call:
ws.broadcast({ type: 'token_event', data: event })

----

packages/api/src/auth.ts

Create middleware:

export function requireAuth(token: string) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || authHeader !== `Bearer ${token}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
  }
}

Only apply this middleware if an authToken was provided to ApiServer.

----

packages/api/src/index.ts

Export a startApi() function:

export async function startApi(options?: {
  port?: number
  authToken?: string
  onReady?: (port: number) => void
}) {
  // 1. Open database
  // 2. Start collector (so logs are being watched)
  // 3. Create engine
  // 4. Create and start ApiServer
  // 5. Call onReady with actual port
  // Return { server, db, watcher } for graceful shutdown
}

----

Write integration tests using supertest:
- Test every GET endpoint returns correct shape
- Test auth middleware blocks unauthenticated requests
- Test export endpoints return correct content-type
- Test alert config PUT validates input
```

---

## Phase 4 — Web Dashboard

### What this phase delivers
- React + Vite app with real-time WebSocket connection
- Live burn rate sparkline (updates every 5s)
- Cumulative cost chart (daily bars)
- Session table with drill-down
- Project breakdown
- Model usage pie chart
- Cache stats panel
- Alert configuration UI
- Dark mode (system default)
- Responsive design

### Claude Code Prompt

```
Build the web dashboard at packages/web.

Tech stack:
- React 18 + TypeScript
- Vite 5
- Recharts for all charts
- Tailwind CSS v3
- Lucide React for icons
- date-fns for date formatting
- React Query (TanStack Query v5) for data fetching

Run: pnpm create vite packages/web --template react-ts
Then install the additional dependencies above.

Configure Vite proxy in vite.config.ts:
server: {
  proxy: {
    '/api': 'http://localhost:57821',
    '/ws': { target: 'ws://localhost:57821', ws: true }
  }
}

----

packages/web/src/

Design aesthetic: INDUSTRIAL / UTILITARIAN
- Background: very dark near-black (#0d0d0d)
- Accent: electric amber (#f59e0b) for live/active states
- Success green (#10b981) for good metrics
- Danger red (#ef4444) for alerts
- Text: near-white (#f5f5f5) primary, gray-400 secondary
- Font: 'JetBrains Mono' for numbers/data, 'Inter' for labels (import both from Google Fonts)
- Borders: thin 1px #2a2a2a lines
- Cards: #161616 background with subtle border
- NO rounded corners on data cards — sharp, utilitarian
- Charts: dark backgrounds with thin luminous lines

----

src/hooks/useWebSocket.ts

Create a WebSocket hook:

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => {
      setIsConnected(false)
      // Reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(connect, 3000)
    }
    ws.onmessage = (event) => {
      try {
        setLastMessage(JSON.parse(event.data))
      } catch {}
    }
  }, [url])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeout.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { isConnected, lastMessage }
}

----

src/hooks/useStats.ts

Create React Query hooks for all API endpoints:

export function useLiveStats() {
  return useQuery({ queryKey: ['live'], queryFn: () => fetch('/api/stats/live').then(r => r.json()), refetchInterval: 5000 })
}

export function useOverviewStats(from: Date, to: Date) {
  return useQuery({ queryKey: ['overview', from, to], queryFn: ... })
}

export function useProjects(from: Date, to: Date) { ... }
export function useSessions(options: SessionOptions) { ... }
export function useSessionTimeline(sessionId: string) { ... }
export function useModels(from: Date, to: Date) { ... }
export function useCacheStats(from: Date, to: Date) { ... }
export function useBurnRateHistory(periodHours: number) { ... }
export function useAlerts() { ... }
export function useAlertConfig() { ... }

Also export useWebSocket integration:
- When a 'token_event' message arrives, invalidate the 'live' and 'overview' query caches
- When an 'alert' message arrives, invalidate the 'alerts' query cache

----

src/components/

Create these components:

--- LiveBurnRate.tsx ---
Displays: current tokens/min and cost/hr as large monospace numbers.
A pulsing green dot when receiving events (turns amber if no event in 60s, red if no event in 5min).
A small sparkline chart (Recharts AreaChart, no axes, thin luminous line) showing last 30 minutes of burn rate.
Updates live from WebSocket.

--- CostChart.tsx ---
Props: dailyStats: DailyStats[], period: '7d' | '30d' | 'month' | 'all'
Recharts BarChart showing daily cost as vertical bars.
X-axis: day labels. Y-axis: USD.
Hover tooltip shows: date, cost, tokens, sessions.
Bars colored: green if below daily average, amber if above, red if > 2x average.

--- SessionTable.tsx ---
Props: sessions: Session[], onSelect: (session: Session) => void
Sortable table columns: project, started, duration, tokens, cost, models used.
Click a row to drill down.
Virtualized with react-window if more than 100 rows.

--- SessionTimeline.tsx ---
Props: sessionId: string
Shows every TokenEvent in the session as a vertical timeline.
Each entry shows: timestamp, model, tool used, tokens, cost.
Token count shown as a horizontal bar (width = tokens / max_tokens_in_session).
Expensive entries highlighted.

--- ProjectBreakdown.tsx ---
Horizontal bar chart (Recharts) showing top 10 projects by cost.
Each bar shows: project name, total cost, session count.
Click a project to filter the whole dashboard.

--- ModelPieChart.tsx ---
Recharts PieChart showing cost distribution by model.
Custom labels showing model name + percentage.
Legend below.

--- CacheStats.tsx ---
Shows cache hit rate as a large percentage with a radial gauge.
Below: estimated savings in USD ("You saved $X.XX with caching").
Daily hit rate as a small line chart.

--- AlertBadge.tsx ---
Small component showing alert count. If > 0, red badge with count.
Click to open AlertsPanel.

--- AlertsPanel.tsx ---
List of recent alerts. Each alert shows: type, message, threshold vs actual, time.
Acknowledge button on each.
Budget configuration form at the bottom:
- Daily budget (USD input)
- Hourly budget (USD input)
- Burn rate spike threshold (multiplier input)
- Slack webhook URL (optional)
Save button calls PUT /api/alerts/config.

--- ConnectionStatus.tsx ---
Small status indicator: green "Live" dot when WebSocket connected, 
amber "Polling" when reconnecting, red "Offline" when API unreachable.

--- PeriodSelector.tsx ---
Tab bar: Today | 7 Days | 30 Days | Month | All Time | Custom Range
Custom range shows two date pickers.
Sets context that all charts and tables consume.

----

src/App.tsx

Layout: full-screen dark dashboard.
Top bar: tokenwatch logo (amber), project filter dropdown, period selector, alert badge, connection status.

Main grid (CSS Grid, responsive):
- Top row: 3 stat cards (Today Cost, Month Cost, Cache Hit Rate) + LiveBurnRate taking remaining space
- Middle row: CostChart (60% width) + ModelPieChart (40% width)
- Bottom row: ProjectBreakdown (40% width) + SessionTable (60% width)
- When session is selected: SessionTimeline slides in as a right panel

Mobile (< 768px): single column stack.

----

src/main.tsx

Wrap in QueryClientProvider with:
QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 2 } } })

Import JetBrains Mono and Inter from Google Fonts in index.html.

----

Make the dashboard feel alive:
- Numbers count up with animation when they first load (use requestAnimationFrame)
- New token events flash the burn rate panel briefly (amber flash, 300ms)
- New alerts cause the alert badge to pulse
- Session table rows fade in when data loads
```

---

## Phase 5 — Terminal UI (TUI)

### What this phase delivers
- Ink-based terminal dashboard
- Live burn rate meter with ASCII sparkline
- Today / 7-day cost summary
- Top 5 sessions table
- Alert status
- Auto-refresh every 3 seconds
- Single-key navigation

### Claude Code Prompt

```
Build the TUI at packages/tui.

Dependencies:
- ink@^4
- react@^18
- @types/react@^18
- ink-table@^3
- ink-spinner@^5
- @tokenwatch/types (workspace:*)
- @tokenwatch/engine (workspace:*)
- @tokenwatch/collector (workspace:*)

packages/tui/src/

----

components/BurnRateMeter.tsx

Shows:
Line 1: "BURN RATE" label in dim gray
Line 2: Large number: "1,234 tokens/min" in bright white, bold
Line 3: Cost rate: "$0.0042/min  ·  $0.25/hr  ·  $6.12/day" in amber
Line 4: ASCII sparkline of last 60 minutes (60 chars wide, using block chars: ▁▂▃▄▅▆▇█)

The sparkline maps token rate to 8 levels using Unicode block elements.
A blinking dot at the end shows the connection is live.

----

components/StatsRow.tsx

Three boxes side by side (using Box with borderStyle="round"):
Box 1: "TODAY"   - cost in USD, total tokens, session count
Box 2: "7 DAYS"  - same fields
Box 3: "MONTH"   - same fields

Each value in bright white, label in dim gray.

----

components/SessionsTable.tsx

Uses ink-table to show top 5 sessions by cost.
Columns: Project (truncated to 20 chars), Started, Tokens, Cost, Models

----

components/AlertsRow.tsx

If no alerts: dim gray text "No alerts"
If alerts: each alert as a red "⚠ {message}" line

----

components/StatusBar.tsx

Bottom line:
"tokenwatch v{version}  |  DB: ~/.tokenwatch/data.db  |  Watching: ~/.claude/projects/  |  Press q to quit"

----

App.tsx

Full layout using Ink Box/Text components:
- Header: "◈ tokenwatch" in amber, bold
- BurnRateMeter
- Blank line
- StatsRow
- Blank line  
- "TOP SESSIONS" header + SessionsTable
- Blank line
- AlertsRow
- StatusBar

Refresh every 3 seconds using setInterval inside useEffect.
On each refresh, re-query the engine for live stats.

useInput hook: 'q' or 'Q' → process.exit(0)

----

packages/tui/src/index.ts (CLI entry point)

#!/usr/bin/env node

import { render } from 'ink'
import React from 'react'
import { App } from './App'
import { startCollector } from '@tokenwatch/collector'

async function main() {
  // Start collector in background
  const { db } = await startCollector()
  
  // Render TUI
  const { waitUntilExit } = render(React.createElement(App, { db }))
  await waitUntilExit()
  db.close()
}

main().catch(console.error)

----

package.json bin:
"bin": { "tokenwatch": "./dist/index.js" }

Make sure the file has #!/usr/bin/env node shebang and is chmod +x after build.

Add to root package.json scripts:
"tokenwatch": "pnpm --filter @tokenwatch/tui run start"
```

---

## Phase 6 — VS Code Extension

### What this phase delivers
- Status bar item showing live token/cost metrics
- Updates every 10 seconds via API
- Click opens the web dashboard
- Color coding (green/amber/red based on burn rate)
- Settings for API URL and refresh interval

### Claude Code Prompt

```
Build the VS Code extension at packages/vscode.

This extension shows a live token meter in the VS Code status bar.
It reads data from the tokenwatch API server (which must be running separately).

Initialize with: yo code (select TypeScript extension)
Or manually create the vscode extension structure.

package.json (extension manifest):
{
  "name": "tokenwatch",
  "displayName": "tokenwatch — Token Meter",
  "description": "Live Claude Code token usage in your status bar",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "configuration": {
      "title": "tokenwatch",
      "properties": {
        "tokenwatch.apiUrl": {
          "type": "string",
          "default": "http://localhost:57821",
          "description": "tokenwatch API server URL"
        },
        "tokenwatch.refreshIntervalSeconds": {
          "type": "number",
          "default": 10,
          "description": "How often to refresh token stats (seconds)"
        },
        "tokenwatch.showCost": {
          "type": "boolean",
          "default": true,
          "description": "Show cost in status bar (vs just token count)"
        }
      }
    },
    "commands": [
      {
        "command": "tokenwatch.openDashboard",
        "title": "tokenwatch: Open Dashboard"
      },
      {
        "command": "tokenwatch.resetToday",
        "title": "tokenwatch: Reset Today's Stats View"
      }
    ]
  }
}

----

src/extension.ts

export function activate(context: vscode.ExtensionContext) {
  
  // Create status bar item (left side, priority 100)
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 100
  )
  statusBarItem.command = 'tokenwatch.openDashboard'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  // Function to update the status bar
  async function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('tokenwatch')
    const apiUrl = config.get<string>('apiUrl', 'http://localhost:57821')
    const showCost = config.get<boolean>('showCost', true)

    try {
      const response = await fetch(`${apiUrl}/api/stats/live`, {
        signal: AbortSignal.timeout(3000)
      })
      
      if (!response.ok) throw new Error('API error')
      
      const stats = await response.json()
      
      const tokensPerMin = Math.round(stats.burnRate.tokensPerMinute)
      const costToday = stats.todayCost.toFixed(4)
      const hasAlerts = stats.alerts.length > 0
      
      // Determine color based on burn rate vs hourly baseline
      let color = new vscode.ThemeColor('statusBar.foreground') // default
      if (stats.burnRate.tokensPerHour > 100000) {
        color = new vscode.ThemeColor('statusBarItem.warningForeground')
      }
      if (hasAlerts) {
        color = new vscode.ThemeColor('statusBarItem.errorForeground')
      }
      
      const alertIndicator = hasAlerts ? ' ⚠' : ''
      
      if (showCost) {
        statusBarItem.text = `$(flame) ${tokensPerMin} t/min · $${costToday}${alertIndicator}`
      } else {
        statusBarItem.text = `$(flame) ${tokensPerMin} tokens/min${alertIndicator}`
      }
      
      statusBarItem.tooltip = [
        `tokenwatch — Live Token Usage`,
        ``,
        `Burn rate: ${tokensPerMin} tokens/min`,
        `Cost rate: $${stats.burnRate.costPerHour.toFixed(4)}/hr`,
        `Today: ${stats.todayTokens.toLocaleString()} tokens · $${costToday}`,
        `Month: $${stats.monthCost.toFixed(4)}`,
        hasAlerts ? `⚠ ${stats.alerts.length} alert(s) active` : `No active alerts`,
        ``,
        `Click to open dashboard`
      ].join('\n')
      
      statusBarItem.color = color
      
    } catch {
      statusBarItem.text = `$(flame) tokenwatch: offline`
      statusBarItem.tooltip = 'tokenwatch API is not running. Start it with: tokenwatch api'
      statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground')
    }
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenwatch.openDashboard', () => {
      const config = vscode.workspace.getConfiguration('tokenwatch')
      const apiUrl = config.get<string>('apiUrl', 'http://localhost:57821')
      // Open dashboard URL (assumed to be running on port 5173 during dev, 57822 in prod)
      const dashUrl = apiUrl.replace('57821', '57822')
      vscode.env.openExternal(vscode.Uri.parse(dashUrl))
    })
  )

  // Initial update + interval
  updateStatusBar()
  const interval = setInterval(() => {
    const config = vscode.workspace.getConfiguration('tokenwatch')
    const refreshSecs = config.get<number>('refreshIntervalSeconds', 10)
    updateStatusBar()
    clearInterval(interval)
    setInterval(updateStatusBar, refreshSecs * 1000)
  }, 0)

  context.subscriptions.push({ dispose: () => clearInterval(interval) })
}

export function deactivate() {}

----

Build config: use esbuild to bundle for VS Code (CommonJS, node target).

Add to tsconfig: "lib": ["ES2022"], "module": "commonjs"

Test manually: press F5 in VS Code to launch Extension Development Host.
```

---

## Phase 7 — Team Mode

### What this phase delivers
- Multi-user support: each user runs a local agent that ships events to a central server
- Central server aggregates across team members
- Per-user and team-wide dashboards
- Shared budget configuration
- Manager view: compare engineers by token usage

### Claude Code Prompt

```
Add team mode to the API server and web dashboard.

This is an optional mode. When enabled:
- Each developer runs: tokenwatch agent --team-server https://your-server.com --user-id alice
- The agent ships local events to the central server via POST /api/team/events
- The central server aggregates events from all users
- A team dashboard at /team shows usage per user

----

packages/api/src/routes/team.ts

Add these endpoints:

POST /api/team/events
  Body: { userId: string; events: TokenEvent[]; authToken: string }
  Validates authToken against TOKENWATCH_TEAM_SECRET env var
  Inserts events into team_events table with userId
  Returns: { accepted: number }

GET /api/team/stats
  Query params: from, to
  Returns: {
    totalCost: number
    totalTokens: number
    byUser: Array<{
      userId: string
      totalCost: number
      totalTokens: number
      sessionCount: number
      topModel: string
    }>
    dailyByUser: Array<{ date: string; userId: string; cost: number; tokens: number }>
  }

GET /api/team/leaderboard
  Returns top 10 users by cost this month, with % of team total

----

Migration 2 — add to database.ts:

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

----

packages/api/src/team-shipper.ts

Class that runs on the developer's machine, reads new events from local DB,
and ships them to the team server:

class TeamShipper {
  constructor(private options: {
    serverUrl: string
    userId: string
    authToken: string
    db: Database
  }) {}

  start(): void {
    // Ship any unshipped events immediately
    // Then ship every 60 seconds
    setInterval(() => this.ship(), 60_000)
    this.ship()
  }

  private async ship(): Promise<void> {
    // Query events WHERE shipped_at IS NULL (add shipped_at column to token_events)
    // POST to ${serverUrl}/api/team/events
    // On success: mark events as shipped
    // On failure: log and retry next interval (exponential backoff up to 10 min)
  }
}

----

packages/web/src/pages/TeamDashboard.tsx

Page showing:
- Total team cost this month (large number)
- Team burn rate (live via WebSocket)
- Per-user bar chart: horizontal bars sorted by monthly cost
- Daily stacked area chart: cost per day, stacked by user
- User table: userId, today cost, month cost, top project, top model

Navigation: add "Team" tab to the main nav (only shown if team mode detected).

----

CLI commands to add to packages/tui/src/index.ts:

tokenwatch agent --team-server <url> --user-id <id> --token <secret>
  Starts local collector + team shipper

tokenwatch team-stats
  Shows team dashboard in terminal (read-only, queries central server)
```

---

## Phase 8 — CI/CD, GitHub Actions & Polish

### What this phase delivers
- GitHub Action that posts token usage summary as PR comment
- `tokenwatch report` CLI command (like codeburn's but better)
- npm publish workflow
- End-to-end tests
- Security scanning with Semgrep
- README with badges, screenshots, quickstart

### Claude Code Prompt

```
Add the finishing touches: CI/CD, GitHub Actions integration, a report CLI, and polish.

----

.github/workflows/ci.yml

name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build

----

.github/workflows/pr-token-report.yml

This workflow runs after a pull request is merged and posts a cost summary.
It requires that the developer has tokenwatch running and exports a JSON report.

name: Token Usage Report
on:
  pull_request:
    types: [closed]

jobs:
  report:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Download token report
        # The developer uploads a report artifact during their Claude Code session
        # Add to your dev workflow: tokenwatch export --format json --output report.json
        # Then in your CI push step: gh workflow run upload-report --field file=report.json
        uses: actions/download-artifact@v4
        with:
          name: tokenwatch-report
          path: .
        continue-on-error: true
      
      - name: Post PR comment
        uses: actions/github-script@v7
        with:
          script: |
            let body = '## 🔥 tokenwatch Token Usage Report\n\n'
            
            try {
              const fs = require('fs')
              const report = JSON.parse(fs.readFileSync('report.json', 'utf-8'))
              
              body += `| Metric | Value |\n|--------|-------|\n`
              body += `| Total tokens | ${report.overview.totalTokens.toLocaleString()} |\n`
              body += `| Total cost | $${report.overview.totalCostUsd.toFixed(4)} |\n`
              body += `| Sessions | ${report.overview.sessionCount} |\n`
              body += `| Cache hit rate | ${(report.overview.cacheHitRate * 100).toFixed(1)}% |\n`
              body += `| Primary model | ${report.topModel} |\n`
              
              if (report.projects.length > 0) {
                body += `\n### By Project\n\n| Project | Tokens | Cost |\n|---------|--------|------|\n`
                report.projects.slice(0, 5).forEach(p => {
                  body += `| ${p.projectName} | ${p.totalTokens.toLocaleString()} | $${p.totalCostUsd.toFixed(4)} |\n`
                })
              }
            } catch {
              body += '_No tokenwatch report artifact found. Run `tokenwatch export -f json -o report.json` during development._\n'
            }
            
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body
            })

----

packages/tui/src/commands/report.ts

Add a full report command (run without launching the interactive TUI):

tokenwatch report [--period today|week|month|30days|all] [--format text|json|csv] [--from YYYY-MM-DD] [--to YYYY-MM-DD]

Text output format (mimics codeburn but more detailed):

┌─────────────────────────────────────────────────────────────┐
│  tokenwatch — Usage Report (Last 7 Days)                    │
│  2026-04-28 → 2026-05-04                                    │
└─────────────────────────────────────────────────────────────┘

OVERVIEW
  Total cost:        $12.3456
  Total tokens:      4,123,456
  Input tokens:      1,234,567
  Output tokens:     987,654
  Cache reads:       1,234,567  (cache hit rate: 87.3%)
  Cache writes:      666,668
  Sessions:          42
  Avg cost/session:  $0.2940

BURN RATE (current)
  Tokens/min:        234
  Cost/hr:           $0.0142

TOP PROJECTS
  myapp              $8.23    (67%)   ████████████████░░░░░░░░
  other-project      $3.12    (25%)   ██████░░░░░░░░░░░░░░░░░░
  experiments        $0.99    (8%)    ██░░░░░░░░░░░░░░░░░░░░░░

MODELS
  claude-sonnet-4-6  $9.45    (77%)   2,891,234 tokens
  claude-opus-4-6    $2.67    (22%)   178,234 tokens
  claude-haiku-4-5   $0.13    (1%)    1,053,988 tokens

DAILY BREAKDOWN
  Mon Apr 28         $1.23    ██
  Tue Apr 29         $2.45    █████
  Wed Apr 30         $3.11    ██████
  Thu May 01         $1.89    ████
  Fri May 02         $2.00    ████
  Sat May 03         $0.45    █
  Sun May 04         $1.12    ██

The bar charts scale to the max value, width 24 chars.

----

.github/workflows/publish.yml

Publish to npm when a GitHub Release is created:

name: Publish
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: pnpm install
      - run: pnpm build
      - run: pnpm -r publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

----

README.md (final version, comprehensive)

Write a complete README with:

1. Header: "# 🔥 tokenwatch" + tagline "The open-source Claude Code token analytics platform"

2. Badges: npm version, license, node version, CI status

3. "Why tokenwatch?" section comparing to codeburn:
   - Web dashboard (codeburn: TUI only)
   - Real-time WebSocket streaming (codeburn: polling)
   - Session timeline drill-down (codeburn: session-level only)
   - VS Code extension (codeburn: none)
   - Team mode (codeburn: single user)
   - AI-powered waste analysis (codeburn: rule-based)
   - GitHub Actions integration (codeburn: none)

4. Quickstart:
   npm install -g tokenwatch
   tokenwatch          # start TUI
   tokenwatch web      # start web dashboard on http://localhost:57822
   tokenwatch report   # print report to terminal

5. Full usage docs for every command

6. Architecture section (brief)

7. Contributing guide

8. License

----

Final security hardening — run Semgrep scan:

Install semgrep and create .semgrep/rules/tokenwatch.yaml with rules checking for:
- No hardcoded secrets or API keys
- No path traversal in file reading (only allow ~/.claude and ~/.tokenwatch paths)
- SQL queries use parameterized statements (check for string concatenation in SQL)
- No eval() usage
- WebSocket auth enforced (if authToken is configured)

Run: semgrep --config .semgrep/rules/ packages/
Fix any findings before the first release.
```

---

## Summary: What makes tokenwatch better than codeburn

| Feature | codeburn | tokenwatch |
|---------|----------|------------|
| Web dashboard | ❌ | ✅ React + real-time |
| WebSocket live streaming | ❌ | ✅ |
| Session timeline drill-down | ❌ | ✅ |
| VS Code extension | ❌ | ✅ Status bar meter |
| Team / multi-user mode | ❌ | ✅ |
| Budget alerts + Slack | ❌ | ✅ |
| GitHub Actions PR comments | ❌ | ✅ |
| Burn rate anomaly detection | ❌ | ✅ |
| Cache hit rate tracking | ✅ | ✅ |
| TUI dashboard | ✅ | ✅ |
| CSV/JSON export | ✅ | ✅ |
| Multi-provider | ✅ | roadmap |

---

*Total phases: 9 (0–8) — estimated build time with Claude Code: 2–3 days*
