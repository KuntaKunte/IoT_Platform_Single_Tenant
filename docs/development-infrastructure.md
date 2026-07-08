# Development Infrastructure

## Components
- PostgreSQL for relational persistence — real `pg.Pool` client (`src/shared/database.js`), schema managed by SQL migrations in `src/migrations/`.
- Redis for cache and transient state — real `ioredis` client (`src/shared/redis.js`); used both as the telemetry ingestion queue (`RedisQueue`) and as a latest-telemetry-value cache.
- MinIO for object storage — real `minio` client (`src/shared/storage.js`), wired up in Phase 11 for firmware binaries and collected device logs (the first modules to actually need file storage). One bucket, key-prefixed per use; `ensureBucket()` runs at server startup next to migrations.
- EMQX for MQTT messaging — real `mqtt` (MQTT.js) client (`src/shared/mqtt.js`); the backend connects as a single trusted internal client and subscribes to `devices/+/telemetry`, `devices/+/heartbeat`, and `devices/+/commands/ack`, and publishes downlink commands to `devices/{deviceId}/commands`.
- Mailpit for SMTP in development — real `nodemailer` client (`src/modules/notifications/channels/email.js`) sends to Mailpit's SMTP port (1025); its web UI/REST API (8025) is used by tests to assert real delivery. Production deployments point `SMTP_*` env vars at a real mail provider instead.
- Queue abstraction and background workers for asynchronous tasks — `MemoryQueue` (in-memory, still available for lightweight use cases) and `RedisQueue` (durable, used by the telemetry pipeline), both consumed via `BackgroundWorker` (`src/shared/queue.js`).
- Migration runner for schema changes — idempotent, tracks applied migrations in a `schema_migrations` table (`src/shared/migrations.js`, `src/migrations/run-migrations.js`).
- Configuration loader for environment-driven setup (`src/shared/config.js`).
- Monitoring hooks for observability (`src/shared/monitoring.js`) — currently an in-memory event log; not yet shipped to an external sink.

## Repository Pattern
`BaseRepository` (`src/shared/repositories/base-repository.js`) runs real parameterized SQL (`findAll`, `findById`, `create`) against the injected `pg` client. Per-module repositories extend it or compose their own queries for entity-specific lookups (e.g. `DeviceRepository.search`/`existsById`, `TelemetryRepository.findLatest`/`findHistory`, `DeviceStatusRepository.touch`/`markStaleOffline`).

## Telemetry pipeline (uplink)

MQTT message (or REST fallback) → Joi validation → device-existence check against the `devices` table → `RedisQueue` → `BackgroundWorker` → PostgreSQL `telemetry_history` + Redis latest-value cache + `device_status` upsert. A `setInterval`-based offline detector periodically flips stale devices to offline.

## Command pipeline (downlink)

`device_commands` (PostgreSQL) is the single source of truth for command lifecycle — no Redis queue is involved, unlike telemetry. A `setInterval`-based dispatcher (`src/modules/commands/dispatcher.js`, same shape as the offline detector) polls for due/retry-due rows, publishes them via the shared MQTT client, and updates `attempts`/`status`. This was a deliberate choice over a Redis delayed queue: Postgres-as-source-of-truth avoids dual-write consistency issues for a feature that needs both scheduling and retry timing, and dispatch latency of a few seconds is acceptable for downlink commands.

## Rules engine

Purely reactive — no new background process. `evaluateRulesForTelemetry` runs inline inside the telemetry worker's `processTelemetryJob`, immediately after the existing DB/cache/status writes. Conditions and actions are stored as `jsonb` arrays on the `rules` table; `rule_versions` holds a full snapshot of every prior version (written just before each update), and `rule_history` records every *matched* evaluation (not every check) with per-action results. Actions run through a small pluggable registry (`src/modules/rules/actions/`) rather than a hardcoded switch, so new action types can be added without touching the evaluation loop. The `webhook` action uses Node's built-in global `fetch` with `AbortSignal.timeout(RULE_WEBHOOK_TIMEOUT_MS)` — no new HTTP client dependency was needed.

## Notification platform

Also purely reactive from the Rules Engine's perspective (`executeNotification` just calls `createAlert`), but genuinely asynchronous internally: alert creation only writes `notification_deliveries` rows; a `setInterval` dispatcher (`src/modules/notifications/dispatcher.js`, same shape as the command dispatcher) drains them and separately advances any alerts due for escalation. This is a deliberate difference from the Rules Engine's synchronous action execution — the charter lists "Retry Queue" as its own deliverable for this phase, so delivery is decoupled from the triggering event rather than attempted inline. `email` and `webhook` channels are real; `sms`/`push` are documented log-only stubs (no third-party credentials configured) that always "succeed" since there's no real failure mode to simulate or retry.

## Dashboard platform

Backend-wise, purely a read/aggregation layer — `getDashboardData` fans out to `getLatestValues`/`getHistoricalTelemetry`/`getDeviceStatus` (mqtt module), `listAlerts` (notifications module), and `getDevice` (devices module), so it introduces no new background process. `dashboards`/`dashboard_templates` store their widget `layout` as a `jsonb` array (client-generated widget IDs, no server-side versioning). The dot-path field-lookup helper (`getFieldValue`) used for chart/gauge metric extraction was promoted from the Rules Engine's private copy to a shared `src/shared/object-path.js` utility, since Dashboards needed the identical logic.

This phase also introduces the platform's first frontend: `frontend/` (React + Vite, Recharts, `react-leaflet`). It is a fully separate npm project with its own dependency tree — nothing frontend-related was added to the root `package.json`. See `docs/architecture.md`'s Dashboard Platform section and `docs/operations/docker-development.md`'s frontend dev server notes for details.

## Reports & analytics

Also a read/aggregation layer, but with two additions no prior phase needed: real SQL time-bucketing (`date_trunc` + jsonb path extraction against `telemetry_history`) and a calendar-based scheduler. `reports`/`report_schedules`/`report_runs` are plain Postgres tables — no new infrastructure component. Exports (`pdfkit` for PDF, `exceljs` for Excel) are generated in-memory and never touch disk or MinIO; scheduled runs reuse the existing Mailpit-backed `email` channel (now supporting `attachments`) to deliver the generated file. The report dispatcher (`src/modules/reports/dispatcher.js`) follows the same `setInterval`/polling shape as every other dispatcher in this codebase (offline detector, command dispatcher, notification dispatcher) — the only difference is what "due" means (a computed `next_run_at` from a daily/weekly/monthly frequency preset, not a short retry timeout).

## Firmware & remote management

Introduces no new background process either — every deliverable (OTA, rollback, remote config, diagnostics, log collection, reboot) rides the existing command dispatcher as a new `device_commands.type`. What's genuinely new here: (1) real MinIO usage, finally, for firmware binaries and collected logs, proxied through authenticated Express routes rather than devices talking to MinIO directly; (2) a small **command ack-hook registry** (`registerAckHook` in `src/modules/commands/services/command-service.js`) so the firmware module can react to a `config_update` command's acknowledgement (updating `device_configurations.reported_config`) without the commands module importing the firmware module — the same pluggable-registry shape as the Rules Engine's actions and the Notification Platform's channels, just applied to command acknowledgement instead of rule matches or alert delivery. `multer` is the first multipart/form-data dependency in this backend (firmware upload, log upload).

## Plugin framework

Introduces no new infrastructure component (no new container, no new external service) — it's purely an in-process extensibility layer over infrastructure that already exists. `plugins/` (repo root) holds plugin directories, each with a `plugin.json` manifest; `src/plugins/loader.js` discovers them via `fs/promises` (no new dependency) and dynamically `import()`s each one's entry file, using `pathToFileURL` for cross-platform-safe absolute-path imports (matters on Windows, where a raw `C:\...` path isn't a valid ESM specifier). The one genuinely new mechanism is a **command-ack-hook-style pluggable registry pattern applied three more times**: Rule actions, Notification channels, and (newly refactored from a hardcoded `switch`) Dashboard widgets all gained `registerX`/`unregisterX` pairs, letting a plugin's `activate(api)` call extend them and its `deactivate()`/a disable action cleanly retract them. A Node `package.json` `"imports"` subpath alias (`#plugin-sdk` → `src/plugins/sdk.js`) gives plugin code a stable, non-relative way to import the SDK — a native ESM feature, not a bundler/dependency addition.

## Notes
Phase 5 moved the platform from scaffolding to a real, testable telemetry pipeline; Phase 6 added the command/downlink counterpart; Phase 7 added the rules engine reacting to telemetry; Phase 8 added the notification platform behind the rules engine's notification action; Phase 9 added the dashboard platform and the first frontend; Phase 10 added reports/analytics (aggregation, trend analysis, PDF/Excel export, scheduled email delivery); Phase 11 added firmware/remote management (OTA, rollback, remote config, diagnostics, log collection) and brought MinIO online for the first time; Phase 12 added the plugin framework, letting industry-specific logic live outside the core codebase. All backend pieces run against the containers defined in `docker-compose.dev.yml`. See `docs/operations/docker-development.md` for how to run the stack locally.
