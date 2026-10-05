#!/usr/bin/env bash
# Fresh-machine bootstrap for OathSteps. Idempotent.
#   ./scripts/bootstrap.sh          # install, env, db, content, browsers
#   ./scripts/bootstrap.sh --no-browsers
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 ($2)"; exit 1; }; }
need node "install Node.js 20.9+ (24 LTS recommended)"
need pnpm "corepack enable && corepack prepare pnpm@latest --activate"

echo "▶ installing dependencies"
pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  echo "▶ creating .env from .env.example with a generated secret"
  cp .env.example .env
  secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  # portable in-place edit
  node -e "const fs=require('fs');let s=fs.readFileSync('.env','utf8');s=s.replace(/^BETTER_AUTH_SECRET=.*$/m,'BETTER_AUTH_SECRET='+process.argv[1]);fs.writeFileSync('.env',s)" "$secret"
fi

mkdir -p data
echo "▶ generating prisma client and applying migrations"
pnpm db:generate
pnpm db:deploy

echo "▶ validating official content packs"
pnpm content:validate >/dev/null && echo "  content ok"

if [[ "${1:-}" != "--no-browsers" ]]; then
  echo "▶ installing Playwright Chromium (for browser tests)"
  pnpm exec playwright install chromium
fi

echo
echo "Done. Next:"
echo "  pnpm dev          # http://localhost:3000"
echo "  pnpm verify       # full verification (writes .harness/evidence/latest.json)"
