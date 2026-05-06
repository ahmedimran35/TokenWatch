#!/bin/bash
# Start tokenwatch API server and web dashboard
# Usage: ./start.sh [auth-token]

set -e

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="${TOKENWATCH_AUTH_TOKEN:-}"
fi

if [ -z "$TOKEN" ]; then
  echo "Error: No auth token provided."
  echo "Usage: $0 <your-auth-token>"
  echo "   or: export TOKENWATCH_AUTH_TOKEN=<token> && $0"
  exit 1
fi

echo "Starting tokenwatch with auth token..."

# Kill any existing instances
pkill -f "node.*packages/api/run.js" 2>/dev/null || true
pkill -f "vite.*web" 2>/dev/null || true
sleep 2

# Start API server (includes collector watching JSONL files)
cd "$(dirname "$0")"
TOKENWATCH_AUTH_TOKEN="$TOKEN" node packages/api/run.js &
API_PID=$!

# Wait for API to be ready
echo "Waiting for API server..."
for i in $(seq 1 15); do
  if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:57821/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Start web dev server
TOKENWATCH_AUTH_TOKEN="$TOKEN" pnpm -F @tokenwatch/web dev &
WEB_PID=$!

echo ""
echo "tokenwatch is running!"
echo "  API:     http://localhost:57821"
echo "  Web:     http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"

# Trap to clean up on exit
trap 'kill $API_PID $WEB_PID 2>/dev/null; exit 0' INT TERM

# Wait for either process to exit
wait
