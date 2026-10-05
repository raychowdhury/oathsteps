#!/usr/bin/env bash
# Starts the compose stack and proves the app can serve and write to its database as the unprivileged user.
# Used by CI and runnable locally:  bash scripts/docker-smoke.sh   (needs a running Docker daemon)
set -euo pipefail
cd "$(dirname "$0")/.."
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-smoke-test-secret-not-for-production-0123456789}"
export HOST_PORT="${HOST_PORT:-3300}"
export APP_URL="http://localhost:${HOST_PORT}"
dc() { docker compose -p oathsteps-smoke "$@"; }
trap 'dc logs --no-color app 2>&1 | tail -20; dc down -v >/dev/null 2>&1' EXIT

dc up -d --build
for _ in $(seq 1 60); do
  [ "$(docker inspect --format '{{.State.Health.Status}}' "$(dc ps -q app)" 2>/dev/null || true)" = "healthy" ] && break
  sleep 2
done
curl -fsS "$APP_URL/api/health" | grep -q '"ok"'
echo "health ok"

email="smoke-$(date +%s)@example.com"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$APP_URL/api/auth/sign-up/email" -H 'content-type: application/json' -H "origin: $APP_URL" -d "{\"email\":\"$email\",\"password\":\"correct-horse-battery-10\",\"name\":\"Smoke\"}")
[ "$code" = "200" ] || { echo "sign-up returned $code (database not writable?)"; exit 1; }
echo "sign-up wrote to the database"
dc exec -T app sh -c 'ls /data/mail | grep -q .' && echo "mail sink wrote a message"
echo "docker smoke passed"
trap - EXIT; dc down -v >/dev/null 2>&1
