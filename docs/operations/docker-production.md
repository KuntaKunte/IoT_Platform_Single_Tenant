# Docker Production Strategy

## Goal
Support reliable, isolated customer deployments in production — one self-contained environment per customer, matching this platform's single-tenant-per-deployment model.

## Image

`Dockerfile` (repo root) builds a two-stage image: a `deps` stage runs `npm ci --omit=dev`, and the final stage copies only `node_modules` + application source on top of `node:20-alpine`. It runs as the non-root `node` user (not root), and ships a `HEALTHCHECK` (a dependency-free inline Node script against `GET /health` — alpine doesn't guarantee `curl`/`wget` are present). `.dockerignore` excludes `node_modules`, `.git`, `tests/`, `frontend/`, `coverage/`, `.env` from the build context — it deliberately does **not** exclude `plugins/`, which the running container needs at runtime for the Phase 12 plugin loader to find anything.

Build and smoke-test locally:

```
docker build -t iot-platform-backend .
docker run --rm iot-platform-backend whoami   # -> node, not root
```

## Configuration

Environment variables and secret stores for sensitive values — no secrets are baked into the image. See `.env.example` for the full list; at minimum, production deployments should set real `JWT_SECRET`/`JWT_REFRESH_SECRET` values (the code falls back to obviously-fake dev defaults if unset) and leave `ALLOW_PRIVATE_WEBHOOK_TARGETS` unset (see `docs/architecture.md`'s Production Hardening section — this exists only for this project's own webhook tests, which deliberately target a local test server).

## Rate limiting, health checks, metrics

- `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS` (general API) and `AUTH_RATE_LIMIT_MAX`/`AUTH_RATE_LIMIT_WINDOW_MS` (login/register/refresh) are env-tunable — the shipped defaults (2000/15min general, 10/15min auth) are reasonable starting points, not guarantees for every deployment's traffic shape.
- `GET /health` (liveness) and `GET /health/ready` (readiness — real Postgres/Redis/MQTT/MinIO checks) are the two endpoints an orchestrator (Docker healthcheck, Kubernetes probes, a load balancer's target check) should use — liveness for a tight restart-on-failure interval, readiness for "should this instance receive traffic."
- `GET /metrics` is unauthenticated Prometheus exposition format, by design (see Monitoring below) — bind it to an internal network / put it behind a reverse-proxy rule in production; don't expose it publicly.

## Backup, Restore, Disaster Recovery

`scripts/backup.sh`/`scripts/restore.sh` — see `docs/operations/disaster-recovery.md` for the full runbook (RPO/RTO expectations, failure scenarios, step-by-step restore procedure). Both scripts are real, tested end-to-end against a Docker Compose Postgres container, not just written and assumed to work.

## Monitoring

`docker-compose.monitoring.yml` (Prometheus + Grafana) is optional, layered on top of whichever compose file runs Postgres/Redis/etc. — see `docs/operations/monitoring.md`.

## Production topology (Phase 14)

`docker-compose.prod.yml` now exists — the production counterpart to `docker-compose.dev.yml`, tying together Postgres/Redis/EMQX/MinIO with the backend and frontend images behind a TLS-terminating Nginx. See `docs/operations/cloud-deployment.md` for the full walkthrough (server prep, secrets, Cloudflare + SSL, CI/CD image publishing via GHCR, `scripts/deploy.sh`, update/rollback). This note previously said no such topology existed yet — it now does, real and locally verified (see that doc's verification notes).

## Notes
- No cloud-provider-specific tooling anywhere in this repo (no Terraform/CloudFormation, no AWS/GCP/Azure SDKs) — deliberately infra-agnostic, matching every other operational doc in this project. `docs/operations/cloud-deployment.md` documents how the same Docker-based path applies to AWS/Azure/GCP's plain-VM offerings; each platform's managed-container service (ECS/Container Apps/Cloud Run) is named there as a future alternative, not built.
- Multi-instance/horizontal scaling (multiple backend replicas behind a load balancer) is not yet supported — rate-limit counters and the background dispatchers' state are in-process/in-memory, correct for one instance but not coordinated across replicas. Documented as a known gap, not addressed this phase.
- This document describes what actually exists in this repo as of Phase 14. It is not a claim that a specific customer's production environment has been stood up — that remains a future, deployment-specific exercise.
