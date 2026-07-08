# Monitoring (Prometheus + Grafana)

## Goal
Give an operator real visibility into request traffic, latency, error rate, and process health — without adding always-on infrastructure to the default dev/test inner loop.

## Bringing it up

The monitoring stack is a separate, optional compose file layered on top of whichever stack is already running the backend's dependencies:

```
docker compose -f docker-compose.dev.yml up -d       # if not already running
npm run dev                                            # the backend itself runs on the host, not in Docker
docker compose -f docker-compose.monitoring.yml up -d # Prometheus + Grafana
```

- **Prometheus**: `http://localhost:9090`. Check `http://localhost:9090/targets` — the `iot-platform-backend` job should show `UP`.
- **Grafana**: `http://localhost:3300` (not 3000 — the backend already owns that port). Default login `admin`/`admin` (`GF_SECURITY_ADMIN_USER`/`GF_SECURITY_ADMIN_PASSWORD` in `docker-compose.monitoring.yml` — change these for anything beyond local dev). The Prometheus datasource and the "IoT Platform Overview" dashboard are both auto-provisioned (`monitoring/grafana/provisioning/`) — no manual click-ops setup needed.

## What's scraped

`GET /metrics` on the backend (`monitoring/prometheus.yml`'s scrape config), which is unauthenticated by design — see `docs/architecture.md`'s Production Hardening section for why, and the note about restricting network access to it in a real deployment. Since the backend runs on the host rather than inside `docker-compose.dev.yml`, Prometheus reaches it via `host.docker.internal` — `docker-compose.monitoring.yml`'s `extra_hosts: host-gateway` entry makes that hostname resolve correctly on both Docker Desktop (Windows/Mac) and Linux.

## The provisioned dashboard

"IoT Platform Overview" (`monitoring/grafana/dashboards/platform-overview.json`), six panels:
- HTTP request rate, broken down by route
- p50 / p95 request latency
- Error rate (5xx responses / total)
- Process memory (RSS)
- Process CPU usage
- Event-loop lag

All backed by `prom-client`'s default Node process metrics plus one custom histogram (`http_request_duration_seconds`, `src/shared/metrics.js`) recorded by `metricsMiddleware` in `app.js`.

## Adding more

Add new panels to `monitoring/grafana/dashboards/platform-overview.json` directly (it's provisioned from disk — Grafana reloads it on change, `updateIntervalSeconds: 30` in `monitoring/grafana/provisioning/dashboards/dashboard.yml`), or add a new `.json` file to the same directory for a separate dashboard. This phase deliberately scoped metrics to HTTP + process-level (see `docs/architecture.md`'s Production Hardening section for the reasoning) — per-domain counters (telemetry ingestion rate, command dispatch success rate, notification delivery latency, etc.) are a documented, reasonable future addition, not built here.

## Tearing it down

```
docker compose -f docker-compose.monitoring.yml down
```

Prometheus/Grafana state (scraped metrics history, any dashboard edits made outside of the provisioned files) is not persisted to a named volume by default — a `down` discards it. Add volume mounts to `docker-compose.monitoring.yml` if you need metrics history to survive a restart.
