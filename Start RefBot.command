#!/bin/zsh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_LOG="${TMPDIR:-/tmp}/refbot-backend.log"
FRONTEND_LOG="${TMPDIR:-/tmp}/refbot-frontend.log"

if ! curl --silent --fail http://127.0.0.1:3001/api/health >/dev/null; then
  (cd "$PROJECT_DIR" && nohup npm run start >"$BACKEND_LOG" 2>&1 </dev/null &)
fi

if ! curl --silent --fail http://127.0.0.1:3000/ >/dev/null; then
  (cd "$PROJECT_DIR/web" && nohup npm run dev >"$FRONTEND_LOG" 2>&1 </dev/null &)
fi

for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:3000/ >/dev/null \
    && curl --silent --fail http://127.0.0.1:3001/api/health >/dev/null; then
    open -a "Google Chrome" http://localhost:3000/
    exit 0
  fi
  sleep 1
done

open -a "Google Chrome" http://localhost:3000/
echo "RefBot did not respond within 30 seconds. Check these logs:"
echo "$FRONTEND_LOG"
echo "$BACKEND_LOG"
read -r "?Press Return to close this window."
