# TokenWatch

**Open-source token analytics and cost monitoring for AI coding assistants.**

Track, analyze, and optimize token usage across Claude Code, Codex, Cursor, GitHub Copilot, Roo Code, KiloCode, and more — all from a single dashboard.

## Features

- **Real-time monitoring** — live burn rate tracking with WebSocket updates
- **Multi-tool support** — auto-discovers logs from Claude, Codex, Cursor, Copilot, Roo Code, KiloCode
- **Analytics dashboard** — cost breakdown by project, model, session, and activity
- **AI cost analytics** — context waste analysis, zombie session detection, session health scoring
- **Alerts & budgets** — daily/hourly budget limits, burn rate spike detection, session cost alerts
- **Structured logging** — production-ready Pino JSON logging
- **Automated backups** — scheduled SQLite backups with 30-day retention
- **Data retention** — configurable cleanup of old events
- **Security** — auth enforcement, per-endpoint rate limiting, HTTPS/TLS, CSP headers

## Quick Start

```bash
git clone https://github.com/ahmedimran35/TokenWatch.git
cd TokenWatch
pnpm install
pnpm build
```

### Development

```bash
TOKENWATCH_AUTH_TOKEN=your-secret pnpm dev
```

Dashboard: http://localhost:5173 | API: http://localhost:57821

### Production

```bash
export TOKENWATCH_AUTH_TOKEN=your-secret
export NODE_ENV=production
node packages/api/run.js
```

See [PRODUCTION.md](./PRODUCTION.md) for deployment guides (systemd, Docker, PM2).

## Architecture

```
┌─────────────────────────────┐
│      Web Dashboard          │
│   React + Vite + Recharts   │
│         (port 5173)         │
└──────────────┬──────────────┘
               │ HTTP / WebSocket
┌──────────────▼──────────────┐
│        API Server           │
│   Express + Helmet + CORS   │
│         (port 57821)        │
└──┬──────────┬──────────┬────┘
   │          │          │
┌──▼──┐  ┌────▼───┐  ┌──▼────────┐
│Engine│  │ SQLite │  │ WebSocket │
│      │  │   DB   │  │Broadcaster│
└──────┘  └───┬────┘  └───────────┘
              │
       ┌──────▼──────┐
       │ File Watcher │
       │ (chokidar)   │
       └─────────────┘
```

### Packages

| Package | Description |
|---------|-------------|
| `@tokenwatch/api` | Express.js API server with auth, rate limiting, WebSocket |
| `@tokenwatch/collector` | File watcher, parser, deduplicator, SQLite database |
| `@tokenwatch/engine` | Analytics engine: burn rate, forecasting, optimization |
| `@tokenwatch/web` | React dashboard with real-time charts |
| `@tokenwatch/cli` | Command-line interface |
| `@tokenwatch/tui` | Terminal UI for in-terminal monitoring |
| `shared/types` | Shared TypeScript type definitions |
| `shared/utils` | Shared utilities (structured logger) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKENWATCH_AUTH_TOKEN` | _(required)_ | Shared secret for API authentication |
| `TOKENWATCH_ALLOW_ANONYMOUS` | `false` | Allow unauthenticated access |
| `TOKENWATCH_CORS_ORIGINS` | `localhost:5173,localhost:3000` | Allowed CORS origins |
| `TOKENWATCH_RATE_LIMIT` | `200` | Requests per minute (global) |
| `TOKENWATCH_RATE_LIMIT_EXPORT` | `50` | Rate limit for export endpoint |
| `TOKENWATCH_RETENTION_DAYS` | `90` | Data retention period |
| `TOKENWATCH_BACKUP_INTERVAL_MS` | `43200000` (12h) | Automated backup interval |
| `TOKENWATCH_TLS_CERT` | - | TLS certificate path |
| `TOKENWATCH_TLS_KEY` | - | TLS private key path |
| `NODE_ENV` | `development` | Set to `production` for JSON logging |

Data is stored in `~/.tokenwatch/` with SQLite WAL mode.

## API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/health` | No | Health check with database status |
| `GET /api/stats/live` | Yes | Live burn rate and totals |
| `GET /api/stats/overview` | Yes | Aggregated statistics |
| `GET /api/stats/burn-rate-history` | Yes | Burn rate time series |
| `GET /api/stats/forecast` | Yes | Cost forecast |
| `GET /api/projects` | Yes | Project breakdown |
| `GET /api/sessions` | Yes | Session list with sorting |
| `GET /api/models` | Yes | Model usage breakdown |
| `GET /api/alerts` | Yes | Active alerts |
| `GET /api/export` | Yes | Export data (stricter rate limit) |
| `GET /api/health-insights/waste` | Yes | Context waste analysis |
| `GET /api/health-insights/zombies` | Yes | Idle/zombie session detection |
| `GET /api/health-insights/scores` | Yes | Session health scores (0-100) |
| `WS /ws` | Yes | WebSocket for live updates |

## AI Cost Analytics

TokenWatch identifies wasteful AI sessions with three analysis modes:

### Context Waste Analysis
Measures input vs output token ratio to find sessions consuming tokens without proportional output. Flags sessions where output/input < 15% as high-waste, ranked by total wasted tokens and cost.

### Zombie Session Detection
Finds idle sessions (no activity for 30+ minutes) that are still consuming tokens. Classifies into three categories:
- **idle** — quietly burning tokens via context refresh
- **context-refresh-spam** — repeatedly refreshing context while idle
- **likely-loop** — stuck in a loop consuming high tokens during idle period

### Session Health Scores
Scores every session 0-100 based on output/input ratio, tool usage, cost efficiency, and throughput. Status levels:
- **Healthy (70+)** — efficient token usage with good output ratio
- **Average (40-69)** — acceptable but could be optimized
- **Poor (20-39)** — low efficiency, likely wasting tokens
- **Stuck (<20)** — near-zero output despite heavy input, possible infinite loop

## TUI (Terminal UI)

Run a full dashboard right inside your terminal:

```bash
pnpm tokenwatch
```

Shows real-time stats, burn rate, sessions, models, alerts, cache efficiency, context waste analysis, zombie session count, and session health scores — no browser needed.

## Development

```bash
pnpm dev        # Watch mode (all packages)
pnpm build      # Build all packages
pnpm typecheck  # Type check
pnpm lint       # Lint
pnpm clean      # Remove build artifacts
```

## Load Testing

```bash
node load-test.js -c 10 -n 100
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): typecheck on Node 20/22, build, lint, dependency audit.

## License

MIT
