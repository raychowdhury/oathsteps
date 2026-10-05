#!/usr/bin/env bash
# Backs up the OathSteps database while the app keeps running, checks the copy, and keeps a rotation.
# Run on the host, from the repository folder, with the stack up. Daily cron example in docs/DEPLOY.md.
#
#   bash scripts/backup.sh
#
# Optional settings (environment or .env):
#   BACKUP_DIR              where backups go on the host          (default: ./backups)
#   BACKUP_KEEP_DAYS        delete local backups older than this  (default: 14)
#   BACKUP_RCLONE_REMOTE    also copy each backup off the machine with rclone, e.g. r2:oathsteps-backups
set -euo pipefail
cd "$(dirname "$0")/.."
# Read only our own keys from .env: sourcing it would choke on values such as MAIL_FROM=Name <address>.
envval() { [ -f .env ] && grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }
BACKUP_DIR="${BACKUP_DIR:-$(envval BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP_DAYS:-$(envval BACKUP_KEEP_DAYS)}"; KEEP="${KEEP:-14}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-$(envval BACKUP_RCLONE_REMOTE)}"
name="oathsteps-$(date -u +%Y-%m-%dT%H%M%SZ).db"
mkdir -p "$BACKUP_DIR"

# SQLite's online backup gives a consistent copy even while the app writes. Then prove the copy opens and is intact.
docker compose exec -T -e BACKUP_NAME="$name" app node -e '
const Database = require("better-sqlite3");
const fs = require("fs");
fs.mkdirSync("/data/backups", { recursive: true });
const out = "/data/backups/" + process.env.BACKUP_NAME;
new Database("/data/oathsteps.db", { readonly: true }).backup(out).then(() => {
  const check = new Database(out, { readonly: true }).pragma("integrity_check", { simple: true });
  if (check !== "ok") { console.error("integrity check failed: " + check); process.exit(1); }
}).catch((e) => { console.error(e.message); process.exit(1); });
'
docker compose cp "app:/data/backups/$name" "$BACKUP_DIR/$name" >/dev/null
docker compose exec -T app rm -f "/data/backups/$name"
gzip -9 "$BACKUP_DIR/$name"
echo "backup ok: $BACKUP_DIR/$name.gz ($(du -h "$BACKUP_DIR/$name.gz" | cut -f1))"

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null || { echo "BACKUP_RCLONE_REMOTE is set but rclone is not installed"; exit 1; }
  rclone copy "$BACKUP_DIR/$name.gz" "$BACKUP_RCLONE_REMOTE"
  echo "copied off the machine to $BACKUP_RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -name 'oathsteps-*.db.gz' -mtime +"$KEEP" -delete
