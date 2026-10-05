#!/usr/bin/env bash
# Restores the OathSteps database from a backup made by scripts/backup.sh.
# The current database is kept in the volume as pre-restore-<time>.db first, so a restore can be undone.
#
#   bash scripts/restore.sh backups/oathsteps-2026-10-05T031500Z.db.gz [--yes]
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:-}"
[ -f "$src" ] || { echo "usage: bash scripts/restore.sh <backup .db or .db.gz> [--yes]"; exit 1; }
if [ "${2:-}" != "--yes" ]; then
  read -r -p "Replace the live database with $src? The app stops for a moment. [y/N] " ok
  [ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "cancelled"; exit 1; }
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
case "$src" in
  *.gz) gunzip -c "$src" > "$tmp/restore.db" ;;
  *) cp "$src" "$tmp/restore.db" ;;
esac
chmod 644 "$tmp/restore.db"

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
docker compose stop app
# The migrate image runs as root and mounts the same volume. It saves the current file, swaps in the backup,
# drops stale write-ahead files, and gives ownership back to the app user.
docker compose run --rm --no-deps -v "$tmp/restore.db:/restore.db:ro" migrate sh -c "
  set -e
  [ -f /data/oathsteps.db ] && cp /data/oathsteps.db /data/pre-restore-$stamp.db
  cp /restore.db /data/oathsteps.db
  rm -f /data/oathsteps.db-wal /data/oathsteps.db-shm
  chown -R 1001:1001 /data
"
docker compose start app
echo "restored from $src (previous database kept as /data/pre-restore-$stamp.db in the volume)"
