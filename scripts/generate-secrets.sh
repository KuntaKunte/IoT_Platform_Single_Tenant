#!/usr/bin/env bash
# Prints strong random values for every secret docker-compose.prod.yml / .env needs.
# Usage: scripts/generate-secrets.sh [>> .env]
set -euo pipefail

echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — paste into .env (see .env.production.example)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
echo "MINIO_ACCESS_KEY=$(openssl rand -hex 8)"
echo "MINIO_SECRET_KEY=$(openssl rand -hex 16)"
