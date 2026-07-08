# Disaster Recovery

Scope: a single-tenant deployment running the Docker Compose stack described in `docker-compose.dev.yml`/`docker-compose.production` equivalents (Postgres, Redis, EMQX, MinIO, the backend, the frontend). Postgres holds essentially all durable state that matters (users, devices, telemetry, rules, alerts, reports, plugin registrations); Redis and EMQX hold transient/in-flight state that's safe to lose (a queued-but-unprocessed telemetry job, an active MQTT session); MinIO holds firmware binaries and collected device logs, which are lower-priority to recover (see below).

## RPO / RTO expectations

- **RPO (Recovery Point Objective)**: bounded by your backup schedule. Running `scripts/backup.sh` nightly via cron means up to 24 hours of data loss in the worst case (a failure right before the next scheduled backup). Run it more often if that's not acceptable for your deployment.
- **RTO (Recovery Time Objective)**: dominated by two things — how long it takes to stand up a fresh Docker Compose stack (minutes, assuming the host/image are ready) and how long `pg_restore` takes for your data volume (seconds for a dev-sized database; scales with real data volume — test this against your actual production data size, this repo's own verification only used a small dataset).

## Backup schedule (recommended)

```
# crontab -e, on the host running docker-compose.dev.yml (or your production compose file)
0 2 * * * BACKUP_RETENTION_DAYS=14 /path/to/repo/scripts/backup.sh >> /var/log/iot-platform-backup.log 2>&1
```

This runs a nightly `pg_dump` and prunes dumps older than 14 days. Adjust the retention window and cadence to your actual RPO requirement. Back up the `backups/` directory itself to storage independent of the host (it's gitignored and lives only on that host's disk by default — a host loss without an off-host copy of `backups/` defeats the whole point).

## Restore procedure

1. Identify the backup file to restore from (`backups/iot_platform-<timestamp>.dump`, or wherever you've archived off-host copies).
2. Bring up the Postgres container if it isn't already running: `docker compose -f docker-compose.dev.yml up -d postgres`.
3. Run the restore script against the **real** target database name (this is destructive — `--clean` drops every object in the target database first):
   ```
   scripts/restore.sh backups/iot_platform-<timestamp>.dump iot_platform
   ```
   You'll be prompted to type the database name to confirm (or pass `--force` to skip the prompt for a scripted/non-interactive recovery).
4. Run `npm run migrate` to apply any migrations newer than the backup (a restore brings back the schema *as it was at backup time* — if the deployed application version has moved forward since, pending migrations still need to run).
5. Bring up the rest of the stack and confirm `GET /health/ready` reports all dependencies healthy.

## Failure scenarios

- **Postgres data corruption or volume loss**: the primary scenario this runbook covers. Restore the most recent backup per the procedure above. Data since that backup is lost (bounded by your RPO).
- **Full host loss**: stand up a fresh host, install Docker, clone the repo (or deploy the built image), restore the docker volumes' worth of state — Postgres via the restore procedure above, `.env`/secrets from your secret store (never from a backup — see below), MinIO/EMQX from scratch (no backup needed — see below).
- **MinIO (firmware/log file) loss**: **explicitly not covered** by `scripts/backup.sh` — it backs up Postgres only. Firmware binaries can be re-uploaded from their original source; collected device logs, if lost, can be re-collected from devices still in the field (`POST /api/v1/devices/:id/logs`) but not from devices that are no longer reachable. Accepted as a lower-priority gap for this phase — a `mc mirror`-based MinIO backup is a reasonable future addition if firmware/log retention becomes a hard requirement.
- **Secrets loss (`.env`, `JWT_SECRET`, etc.)**: not covered by the Postgres backup (deliberately — secrets shouldn't live in a database dump). Keep these in a proper secret store or password manager, not solely on the host that could be lost.
- **EMQX/Redis loss**: no backup needed — both hold only transient state (in-flight MQTT sessions, queued-but-unprocessed jobs) that's safe to lose and will naturally repopulate as devices reconnect and new telemetry arrives.

## What's verified vs. what's assumed

Verified end-to-end this phase: a real `pg_dump` against the dev Postgres container, followed by a real `pg_restore` into a throwaway database, with row counts diffed to confirm data integrity. **Not verified**: restore timing/behavior against a production-sized dataset, a genuine full-host-loss drill, or MinIO recovery (out of scope, see above). Treat the RTO estimate above as a starting assumption to validate against your own data volume, not a guarantee.
