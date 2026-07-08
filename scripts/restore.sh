#!/usr/bin/env bash
# Restores a pg_dump custom-format backup (see scripts/backup.sh) into a target
# database on the Postgres container. Destructive: --clean drops every object
# in the target database before restoring, so this requires either an explicit
# --force flag or typed confirmation.
#
# Usage: scripts/restore.sh <backup-file> <target-database> [--force]
# Env overrides: COMPOSE_FILE, POSTGRES_SERVICE, POSTGRES_USER
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-iot_user}"

usage() {
  echo "Usage: $0 <backup-file> <target-database> [--force]" >&2
  echo "  <target-database> is required. This is destructive: --clean drops every" >&2
  echo "  object in the target database before restoring. Do not point this at a" >&2
  echo "  live application database unless you mean to overwrite it." >&2
  exit 1
}

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-}"
FORCE="${3:-}"

[ -z "$BACKUP_FILE" ] && usage
[ -z "$TARGET_DB" ] && usage
[ ! -f "$BACKUP_FILE" ] && { echo "Backup file not found: $BACKUP_FILE" >&2; exit 1; }

if [ "$FORCE" != "--force" ]; then
  read -r -p "This will DROP AND RECREATE every object in database '$TARGET_DB'. Type the database name to confirm: " CONFIRM
  if [ "$CONFIRM" != "$TARGET_DB" ]; then
    echo "Confirmation did not match. Aborting." >&2
    exit 1
  fi
fi

echo "Ensuring target database '$TARGET_DB' exists..."
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  createdb -U "$POSTGRES_USER" "$TARGET_DB" 2>/dev/null || true

echo "Restoring $BACKUP_FILE into '$TARGET_DB' (service '$POSTGRES_SERVICE')..."
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_restore -U "$POSTGRES_USER" -d "$TARGET_DB" --clean --if-exists --no-owner < "$BACKUP_FILE"

echo "Restore complete."
