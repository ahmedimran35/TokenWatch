# TokenWatch

**Open-source token analytics and cost monitoring for AI coding assistants.**

If you use Claude Code, Codex, Cursor, GitHub Copilot, Roo Code, KiloCode, or similar AI coding tools — you are spending real money on tokens. TokenWatch shows you **exactly where that money goes**, which sessions are wasting tokens, and when AI assistants are stuck in loops burning cash while you walk away from your desk.

It works by reading the JSONL log files these tools already write to disk. No API keys, no cloud services, no agent — just a local file watcher that feeds a SQLite database and a real-time dashboard.

---

## What Problem Does This Solve?

AI coding assistants are powerful but opaque. You send a prompt, tokens flow, you get a response. But behind the scenes:

- **Context bloat** — Every new message resends your entire conversation history. A 50-message conversation might be sending 500K tokens per request just for context refresh.
- **Zombie sessions** — Leave a Claude Code session open overnight and it keeps refreshing context every few minutes, burning tokens while idle.
- **Infinite loops** — An agent can get stuck in a read-write loop, making thousands of API calls with zero useful output.
- **No visibility** — Your cloud provider shows total spend but never tells you *which session* wasted $15 or *which project* is burning 80% of your budget.

TokenWatch catches all of this in real-time and shows it on a dashboard.

---

## What You Get

### Real-Time Cost Dashboard

A browser-based UI showing your live token spend, broken down by:
- **Projects** — which codebases are costing the most
- **Models** — how much each model (Claude Sonnet, GPT-4, etc.) is costing
- **Sessions** — per-session cost with timelines and event details
- **Activities** — classified into Coding, Debugging, Exploration, etc.
- **Tools** — which tools (Read, Write, Bash, etc.) are called most
- **Cache** — how much you're saving from provider-side caching
- **Budget Utilization** — real-time progress bars showing daily, hourly, monthly, and session budget consumption
- **Notifications** — Slack, Discord, and generic webhook delivery when alerts trigger

### Burn Rate Monitoring

See your token spend rate in real-time — tokens per minute, cost per minute, with spike detection. Set budget alerts and get notified when spend exceeds thresholds.

### AI Cost Analytics

Three health insight modes that find wasted money:

**Context Waste Analysis** — measures input vs output token ratio per session. Sessions where output is < 15% of input are flagged as high-waste. You see exactly how many tokens were wasted and the dollar cost.

**Zombie Session Detection** — finds open sessions with no user activity for 30+ minutes that are still consuming tokens. Classifies them as:
- `idle` — quietly burning via context refresh
- `context-refresh-spam` — aggressively re-sending context while idle
- `likely-loop` — stuck in a loop consuming heavy tokens with no progress

**Session Health Scores** — every session gets a 0-100 score based on output ratio, tool usage, cost efficiency, and throughput. Poor and stuck sessions are flagged with specific warnings like *"High input, near-zero output — likely infinite loop"*.

### Alerts & Budgets

Set daily, hourly, or per-session budget limits. Get notifications delivered to Slack, Discord, or any webhook when:
- Daily spend exceeds a threshold
- Hourly burn rate exceeds a threshold
- Individual session costs exceed a limit
- Burn rate spikes (sudden 3x+ increase)

The dashboard shows a **Budget Utilization** panel with real-time progress bars for every active budget, plus a projected month-end cost estimate.

Configure alerts and notification channels from the gear icon in the dashboard header. No restart needed — changes take effect immediately.

### Session Timeline

Click into any session to see a chronological timeline of every API call — model used, tokens consumed, tools called, and duration.

### Terminal UI (TUI)

Run `pnpm tokenwatch` for a full dashboard inside your terminal. No browser needed. Shows live stats, burn rate, sessions, models, alerts, cache efficiency, context waste, zombie sessions, and health scores.

### Export & API

Full REST API with authentication, rate limiting, and CORS. Export data as JSON for your own analysis. WebSocket support for real-time streaming.

---

## Supported Tools

TokenWatch discovers and reads JSONL log files from:

| Tool | Log Location | Provider |
|------|-------------|----------|
| **Claude Code** | `~/.claude/projects/` | claude |
| **Codex** | `~/.codex/sessions/` | codex |
| **Cursor** | `~/.cursor/logs/` | cursor |
| **GitHub Copilot** | `~/.github_copilot/` | copilot |
| **Roo Code** | `~/.roo/code/` | roo-code |
| **KiloCode** | `~/.kilocode/` | kilocode |

Add new tools by adding a provider config in `packages/collector/src/providers.ts`.

---

## Quick Start

### Prerequisites

- **Node.js 20+** (tested on Node 25)
- **pnpm** (`npm install -g pnpm`)
- **macOS / Linux** (Windows support for file watcher paths may vary)

### Install

```bash
git clone https://github.com/ahmedimran35/TokenWatch.git
cd TokenWatch
pnpm install
pnpm build
```

### Run

```bash
# Option 1: Allow anonymous access (local dev)
TOKENWATCH_ALLOW_ANONYMOUS=true node packages/api/run.js

# Option 2: Require auth (production)
TOKENWATCH_AUTH_TOKEN=my-secret node packages/api/run.js
```

Then open:
- **Dashboard**: http://localhost:5173
- **API**: http://localhost:57821

### Development Mode

```bash
TOKENWATCH_ALLOW_ANONYMOUS=true pnpm dev
```

This runs the API server and web dashboard in watch mode. Changes to source files trigger instant reloads.

### Terminal UI

```bash
pnpm tokenwatch
```

Run directly in your terminal. Uses `← →` or `1-4` to switch time periods, `q` to quit.

### Production

```bash
export TOKENWATCH_AUTH_TOKEN=your-secret
export NODE_ENV=production
node packages/api/run.js
```

See [PRODUCTION.md](./PRODUCTION.md) for systemd, Docker, and PM2 deployment guides.

---

## How It Works

```
┌──────────────────────────────────────────────────────┐
│                  AI Coding Tools                      │
│  Claude  │  Codex  │  Cursor  │  Copilot  │  Roo     │
│  .jsonl  │  .jsonl │  .jsonl  │  .jsonl   │ .jsonl   │
└────┬──────────┬─────────┬──────────┬─────────┬────────┘
     │          │         │          │         │
     └──────────┴─────────┴──────────┴─────────┘
                          │
              File System (JSONL logs)
                          │
     ┌────────────────────▼────────────────────┐
     │         TokenWatch Collector            │
     │  ┌───────────┐  ┌──────────────────┐    │
     │  │ chokidar  │──│ JSONL Parser     │    │
     │  │ watcher   │  │ Deduplicator     │    │
     │  └───────────┘  └────────┬─────────┘    │
     └───────────────────────────┼──────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    SQLite Database      │
                    │  ~/.tokenwatch/tokens.db│
                    │  (WAL mode, backups)    │
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼─────────┐  ┌───────▼───────┐  ┌───────────▼───────────┐
│   Analytics Engine│  │  API Server   │  │  WebSocket Broadcaster│
│  Burn rate,       │  │  Express      │  │  Real-time streaming  │
│  Health scores,   │  │  Auth, Rate   │  │  to web dashboard     │
│  Forecast, Yield  │  │  Limit, CORS  │  │                       │
└───────────────────┘  └───────┬───────┘  └───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Web Dashboard     │
                    │   React + Recharts  │
                    │   http://:5173      │
                    └─────────────────────┘
```

### The Flow

1. **Discover** — At startup, TokenWatch scans known directories for JSONL log files from supported AI tools
2. **Watch** — Uses `chokidar` to monitor files for changes (append events)
3. **Parse** — Extracts token events from JSONL lines (input/output/cache tokens, cost, model, tool usage)
4. **Deduplicate** — Each event has a unique message ID; duplicates are silently dropped
5. **Store** — Events go into SQLite with session aggregation (totals, models used, tools used)
6. **Analyze** — Engine computes burn rates, health scores, forecasts, waste analysis
7. **Serve** — REST API + WebSocket broadcast to web dashboard and TUI

### Data Model

All data stays local in `~/.tokenwatch/tokens.db`:
- `token_events` — individual API calls with token counts, costs, tool usage
- `sessions` — aggregated session data (totals, models, tools, duration)
- `watcher_state` — file positions to avoid re-reading processed lines
- `alert_events` — triggered budget and burn rate alerts
- `team_events` — team billing events (if configured)

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKENWATCH_AUTH_TOKEN` | _(required)_ | Shared secret for API authentication. Set this in production. |
| `TOKENWATCH_ALLOW_ANONYMOUS` | `false` | Set `true` to skip auth (local dev only). |
| `TOKENWATCH_CORS_ORIGINS` | `localhost:5173,localhost:3000` | Comma-separated allowed origins. |
| `TOKENWATCH_RATE_LIMIT` | `200` | Max requests per minute (standard endpoints). |
| `TOKENWATCH_RATE_LIMIT_EXPORT` | `50` | Max requests per minute (export endpoint). |
| `TOKENWATCH_RETENTION_DAYS` | `90` | Auto-delete events older than N days. Set `0` to disable. |
| `TOKENWATCH_BACKUP_INTERVAL_MS` | `43200000` (12h) | Interval between automated SQLite backups. |
| `TOKENWATCH_TLS_CERT` | - | TLS certificate file path (enables HTTPS). |
| `TOKENWATCH_TLS_KEY` | - | TLS private key file path. |
| `NODE_ENV` | `development` | Set to `production` for JSON structured logging. |

Data is stored in `~/.tokenwatch/` directory with SQLite WAL mode for crash safety.

---

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/health` | No | Health check with database connectivity status |
| `GET /api/stats/live` | Yes | Live burn rate, today/month totals, active session |
| `GET /api/stats/overview` | Yes | Aggregated stats with daily breakdown |
| `GET /api/stats/burn-rate-history` | Yes | Burn rate time series data |
| `GET /api/stats/forecast` | Yes | Cost forecast based on current trends |
| `GET /api/stats/model-compare` | Yes | Model usage comparison over time |
| `GET /api/projects` | Yes | Cost breakdown by project |
| `GET /api/sessions` | Yes | Session list with sorting and filtering |
| `GET /api/models` | Yes | Model usage and cost breakdown |
| `GET /api/cache` | Yes | Cache hit rate and savings stats |
| `GET /api/alerts` | Yes | Active (unacknowledged) alerts |
| `GET /api/alerts/config` | Yes | Get alert and budget configuration |
| `PUT /api/alerts/config` | Yes | Update alert/budget/notification settings |
| `POST /api/alerts/:id/acknowledge` | Yes | Acknowledge an alert |
| `GET /api/alerts/budget-utilization` | Yes | Current budget usage with progress percentages |
| `GET /api/export` | Yes | Export all data (stricter rate limit) |
| `GET /api/health-insights/waste` | Yes | Context waste analysis report |
| `GET /api/health-insights/zombies` | Yes | Idle/zombie session detection |
| `GET /api/health-insights/scores` | Yes | Session health scores (0-100) |
| `GET /api/tools` | Yes | Tool usage statistics |
| `GET /api/activities` | Yes | Activity classification breakdown |
| `GET /api/shell-commands` | Yes | Shell command usage stats |
| `GET /api/optimize` | Yes | Optimization recommendations |
| `GET /api/yield` | Yes | Session yield analysis (productive vs abandoned) |
| `GET /api/session-events` | Yes | Events for a specific session |
| `WS /ws` | Yes | WebSocket for real-time streaming updates |

---

## Project Structure

| Package | Purpose |
|---------|---------|
| `@tokenwatch/api` | Express.js server with auth, rate limiting, WebSocket, all routes |
| `@tokenwatch/collector` | File discovery, chokidar watcher, JSONL parser, deduplicator, SQLite |
| `@tokenwatch/engine` | Analytics: burn rate, forecasting, health scores, waste analysis, yield |
| `@tokenwatch/web` | React + Vite + Recharts dashboard |
| `@tokenwatch/cli` | Command-line interface |
| `@tokenwatch/tui` | Terminal UI (Ink) for in-terminal monitoring |
| `shared/types` | TypeScript type definitions shared across packages |
| `shared/utils` | Shared utilities (Pino structured logger) |

---

## Development

```bash
pnpm dev         # Watch mode — runs API + web dashboard with hot reload
pnpm build       # Build all packages
pnpm typecheck   # TypeScript type checking
pnpm lint        # ESLint
pnpm clean       # Remove dist/ directories
```

### Load Testing

```bash
node load-test.js -c 10 -n 100   # 10 concurrent, 100 total requests
```

### Adding a New Provider

1. Add log directory pattern to `packages/collector/src/providers.ts`
2. Parse the JSONL format specific to that tool
3. Map fields to the `TokenEvent` type in `shared/types`

### CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push:
- TypeScript type checking (Node 20, 22)
- Build all packages
- ESLint
- `pnpm audit` for dependency vulnerabilities

---

## License

MIT
