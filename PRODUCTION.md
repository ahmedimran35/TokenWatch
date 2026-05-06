# Production Deployment Guide

## Overview

This guide covers deploying tokenwatch in production environments.

## Requirements

- Node.js 20+ (tested on 22)
- SQLite (automatic, uses local file)
- 512MB+ RAM
- 1GB+ disk space (depends on data retention period)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TOKENWATCH_AUTH_TOKEN` | No* | - | Shared secret for API access. If not set, must set `TOKENWATCH_ALLOW_ANONYMOUS=true`. |
| `TOKENWATCH_ALLOW_ANONYMOUS` | No | `false` | If `true`, API accessible without auth. **Only for development.** |
| `TOKENWATCH_CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed CORS origins. |
| `TOKENWATCH_RATE_LIMIT` | No | `200` | Global rate limit (requests per minute). |
| `TOKENWATCH_RATE_LIMIT_EXPORT` | No | `50` | Rate limit for `/api/export` endpoint. |
| `TOKENWATCH_WS_MAX_CLIENTS` | No | `10` | Max concurrent WebSocket connections. |
| `TOKENWATCH_RETENTION_DAYS` | No | `90` | Days to retain token events and ended sessions. |
| `TOKENWATCH_BACKUP_INTERVAL_MS` | No | `43200000` (12h) | Backup interval in milliseconds. |
| `TOKENWATCH_WAL_CHECKPOINT_INTERVAL_MS` | No | `3600000` (1h) | WAL checkpoint interval. |
| `TOKENWATCH_TLS_CERT` | No | - | Path to TLS certificate file for HTTPS. |
| `TOKENWATCH_TLS_KEY` | No | - | Path to TLS private key file. |
| `NODE_ENV` | No | `development` | Set to `production` for structured JSON logging. |

*\*Auth token is strongly recommended for production. If both `TOKENWATCH_AUTH_TOKEN` and `TOKENWATCH_ALLOW_ANONYMOUS=true` are set, auth is not enforced.*

## Data Directory

- Default location: `~/.tokenwatch/`
- Files:
  - `data.db` — SQLite database with WAL mode
  - `config.json` — User configuration (alerts, currency, aliases)
  - `cache/` — Pricing cache and daily aggregates
  - `backups/` — Automated timestamped backups

**Permissions**: All files should be `0600`, directories `0700`. Owned by the service user.

## Database Maintenance

The system automatically performs:

1. **WAL Checkpointing**: Every hour (configurable). Truncates the WAL file.
2. **Data Retention**: Daily cleanup of events older than `TOKENWATCH_RETENTION_DAYS`. Deletes both `token_events` and `sessions`.
3. **Backups**: Every 12 hours (configurable) to `~/.tokenwatch/backups/data-<timestamp>.db`.
4. **Backup Retention**: Keeps backups from the last 30 days. Old files are automatically deleted.

Manual maintenance commands:

```bash
# Force immediate checkpoint
sqlite3 ~/.tokenwatch/data.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Create backup now
node packages/api/dist/server.js # calls createBackup() on demand (expose via API or script)

# Prune old backups manually
# (use find + delete for backups > 30 days)
```

## Deployment Options

### 1. Systemd Service (Linux)

Create `/etc/systemd/system/tokenwatch.service`:

```ini
[Unit]
Description=Tokenwatch API
After=network.target

[Service]
Type=simple
User=tokenwatch
Environment=NODE_ENV=production
Environment=TOKENWATCH_AUTH_TOKEN=your-secret-token-here
Environment=TOKENWATCH_PORT=57821
# Add other env vars as needed
WorkingDirectory=/opt/tokenwatch
ExecStart=/usr/bin/node /opt/tokenwatch/packages/api/run.js
Restart=on-failure
RestartSec=10
# Security hardening
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/tokenwatch/.tokenwatch

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tokenwatch
sudo systemctl start tokenwatch
sudo systemctl status tokenwatch
```

Logs: `journalctl -u tokenwatch -f`

### 2. Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm build

FROM node:22-alpine
RUN apk add --no-cache sqlite
WORKDIR /app
COPY --from=builder /app ./
COPY --from=builder /app/node_modules ./node_modules
USER node
ENV NODE_ENV=production
EXPOSE 57821
CMD ["node", "packages/api/run.js"]
```

### 3. PM2

```bash
npm install -g pm2
pm2 start packages/api/run.js --name tokenwatch --env production
pm2 save && pm2 startup
```

## Web Dashboard

The dashboard is built with Vite and served via Vite dev server or static files.

- **Development**: `pnpm --filter @tokenwatch/web run dev` (runs on port 5173)
- **Production**: Build and serve static files:

```bash
pnpm --filter @tokenwatch/web run build
# dist/ contains static files. Serve with nginx, caddy, etc.
```

Example nginx config:

```nginx
server {
    listen 80;
    server_name tokenwatch.example.com;

    # Redirect to HTTPS (if using TLS)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tokenwatch.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_key /path/to/key.pem;

    root /var/www/tokenwatch/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:57821;
        proxy_set_header Host $host;
        # Vite dev server proxy automatically adds Authorization header
        # For production, you may need to add it here:
        # proxy_set_header Authorization "Bearer your-token-here";
    }

    location /ws {
        proxy_pass http://localhost:57821;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Health Checks

- **Endpoint**: `GET /api/health`
- **Auth**: None (always accessible)
- **Response**:

```json
{
  "status": "ok",           // "ok" or "degraded"
  "uptime": 1234.56,
  "database": "ok",         // "ok" or "error"
  "timestamp": "2026-05-05T22:00:00Z"
}
```

For Kubernetes/compose health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:57821/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

## Monitoring

### Metrics (basic)

The API exposes:

- `/api/stats/live` — current burn rate and totals
- `/api/stats/overview` — aggregated statistics
- `/api/alerts` — active alerts

For production monitoring, consider:

1. Exporting custom metrics via Prometheus client (future work)
2. Setting up alerts on:
   - `database === "degraded"` from health endpoint
   - High error rate (5xx responses)
   - Disk usage exceeding threshold (check `~/.tokenwatch/`)

### Logs

Structured JSON logs are output to stdout (or file when `NODE_ENV=production`). Use a log shipper (Fluentd, Loki) to collect.

Log fields:

```ts
{
  "level": "error" | "warn" | "info" | "debug" | "fatal",
  "time": "2026-05-05T22:00:00.000Z",
  "pid": 12345,
  "hostname": "host",
  "name": "api" | "collector",
  "msg": "Human readable message",
  ...custom fields
}
```

## Security Checklist

- [ ] Set `TOKENWATCH_AUTH_TOKEN` to a strong random secret
- [ ] Set `TOKENWATCH_ALLOW_ANONYMOUS=false` (or omit)
- [ ] Restrict `TOKENWATCH_CORS_ORIGINS` to specific domains
- [ ] Enable HTTPS (set `TOKENWATCH_TLS_CERT` and `TOKENWATCH_TLS_KEY`)
- [ ] Set file permissions on `~/.tokenwatch/` to `0600`/`0700`
- [ ] Run as non-root user
- [ ] Configure firewall to allow only necessary ports (57821, 9222 if needed)
- [ ] Enable and monitor audit logs

## Troubleshooting

### "Authentication required" error
- Verify `TOKENWATCH_AUTH_TOKEN` is set in the API process environment
- If using the web dashboard, ensure `TOKENWATCH_AUTH_TOKEN` is set in the Vite `.env` file so the proxy injects the header

### Database locked / errors
- SQLite uses WAL mode. If the database is locked, check for long-running transactions.
- Restarting the API releases any stale locks.
- Consider moving `~/.tokenwatch/` to a dedicated disk if I/O contention.

### High memory usage
- Deduplicator caches are bounded (LRU eviction). Current limits:
  - Message IDs: 100,000
  - Session IDs: 10,000 per provider
  - Conversation timestamps: 50,000
  - Response IDs: 50,000
- These should be sufficient for most workloads. Monitor and adjust if needed.

### Backups not being created
- Check `TOKENWATCH_BACKUP_INTERVAL_MS` (default 12h)
- Verify permissions on `~/.tokenwatch/backups/`
- Look for errors in logs: level=`error`, msg=`Database backup failed`

### Data not being collected
- Ensure the file watcher can access Claude Code / Cursor / Copilot log directories
- Check watcher logs for "Skipping file" warnings (size limits)
- Verify the collector process is running and has permissions

## Upgrading

1. Stop the API and collector (if running separately)
2. Pull new code
3. Run `pnpm install`
4. Run `pnpm build`
5. Start services
6. Verify data integrity

Database schema migrations are automatic on startup. Backups are strongly recommended before upgrading.

## Support

- Issues: https://github.com/anomalyco/opencode/issues
- Documentation: See README.md
