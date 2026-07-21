#!/usr/bin/env bash
# update-backend-url.sh
#
# Manual override: points the Cloudflare Pages project's BACKEND_URL secret
# at a specific backend URL. This is a one-time setup step (run it once after
# your Render service is live) and should rarely be needed again, since the
# Render URL does not change between deploys.
#
# Usage:
#   ./update-backend-url.sh https://pricepulse-api.onrender.com
#
# You can also run it with no argument to spin up a temporary Cloudflare
# quick tunnel to a locally running backend, useful only for debugging a
# local build against the live frontend.
#
# Requirements: `wrangler` installed and on PATH, `wrangler login` done once.

set -euo pipefail

PROJECT_NAME="pricepulse"          # the Pages *project* name (see: wrangler pages project list)
PROJECT_DOMAIN="pricepulse-cw6"    # the *.pages.dev subdomain
BACKEND_PORT="5050"

if [ "${1:-}" != "" ]; then
  URL="$1"
  echo "Using provided URL: $URL"
else
  echo "No URL given. Starting a temporary Cloudflare quick tunnel to http://localhost:${BACKEND_PORT} for local debugging..."
  echo "(Leave this running. Press Ctrl+C to stop the tunnel when you're done.)"

  LOGFILE="$(mktemp)"
  cloudflared tunnel --url "http://localhost:${BACKEND_PORT}" > "$LOGFILE" 2>&1 &
  TUNNEL_PID=$!

  URL=""
  for i in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOGFILE" | head -n1 || true)
    if [ -n "$URL" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$URL" ]; then
    echo "Could not detect the tunnel URL after 30s. Check the log:"
    cat "$LOGFILE"
    kill "$TUNNEL_PID" 2>/dev/null || true
    exit 1
  fi

  echo "Tunnel is live at: $URL"
  echo "(tunnel running in background, pid $TUNNEL_PID, kill it with: kill $TUNNEL_PID)"
fi

echo "Setting BACKEND_URL on Cloudflare Pages project '${PROJECT_NAME}' ..."
echo "$URL" | npx wrangler pages secret put BACKEND_URL --project-name="$PROJECT_NAME"

echo "Done. Test it: curl \"https://${PROJECT_DOMAIN}.pages.dev/api/health\" (or your actual API route)."
