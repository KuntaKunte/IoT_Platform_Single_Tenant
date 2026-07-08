#!/usr/bin/env bash
# Deploys the current docker-compose.prod.yml topology to a remote Docker host over
# SSH: pulls the configured images, recreates changed services, and blocks until the
# new containers' HEALTHCHECK passes (docker compose up -d --wait) before considering
# the deploy successful. On failure, prints the rollback command instead of guessing.
#
# Usage: scripts/deploy.sh <ssh-host> [remote-dir]
#   <ssh-host>   any target `ssh` accepts (user@host, or an entry in ~/.ssh/config)
#   [remote-dir] directory on the remote host containing docker-compose.prod.yml + .env
#                (default: /opt/iot-platform)
#
# Env overrides: BACKEND_IMAGE, FRONTEND_IMAGE (passed through to the remote
# `docker compose` invocation — set these to pin a specific tag, e.g. for rollback).
set -euo pipefail

HOST="${1:?Usage: scripts/deploy.sh <ssh-host> [remote-dir]}"
REMOTE_DIR="${2:-/opt/iot-platform}"
IMAGE_ENV="BACKEND_IMAGE=${BACKEND_IMAGE:-} FRONTEND_IMAGE=${FRONTEND_IMAGE:-}"

echo "Deploying to $HOST:$REMOTE_DIR..."

echo "--- pulling images ---"
ssh "$HOST" "cd $REMOTE_DIR && $IMAGE_ENV docker compose -f docker-compose.prod.yml pull"

echo "--- recreating services (waiting for healthchecks) ---"
ssh "$HOST" "cd $REMOTE_DIR && $IMAGE_ENV docker compose -f docker-compose.prod.yml up -d --wait"

echo "--- verifying readiness ---"
if ! ssh "$HOST" "curl -sf http://localhost:3000/health/ready"; then
  echo "" >&2
  echo "Readiness check failed after deploy. To roll back to a known-good tag:" >&2
  echo "  BACKEND_IMAGE=<previous-tag> FRONTEND_IMAGE=<previous-tag> scripts/deploy.sh $HOST $REMOTE_DIR" >&2
  exit 1
fi

echo ""
echo "Deploy successful."
