#!/usr/bin/env bash
# Dumps the Postgres database running in docker-compose.dev.yml (or the compose
# file named via $COMPOSE_FILE) to a timestamped pg_dump custom-format file.
#
# Usage: scripts/backup.sh
# Env overrides: COMPOSE_FILE, POSTGRES_SERVICE, POSTGRES_USER, POSTGRES_DB,
#                BACKUP_DIR, BACKUP_RETENTION_DAYS (prune older dumps if set)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-iot_user}"
POSTGRES_DB="${POSTGRES_DB:-iot_platform}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="$BACKUP_DIR/${POSTGRES_DB}-${TIMESTAMP}.dump"

echo "Backing up '$POSTGRES_DB' from service '$POSTGRES_SERVICE' to $OUTPUT_FILE..."
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$OUTPUT_FILE"

echo "Backup complete: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"

if [ -n "$BACKUP_RETENTION_DAYS" ]; then
  echo "Pruning backups older than $BACKUP_RETENTION_DAYS day(s) in $BACKUP_DIR..."
  find "$BACKUP_DIR" -name "${POSTGRES_DB}-*.dump" -mtime "+$BACKUP_RETENTION_DAYS" -print -delete
fi
