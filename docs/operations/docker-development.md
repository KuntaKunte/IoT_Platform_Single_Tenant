# Docker Development Strategy

## Goal
Provide a consistent development environment for local work.

## Approach
- `docker-compose.dev.yml` defines PostgreSQL 16, Redis 7, EMQX 5.7, MinIO, and Mailpit for local development.
- The Node.js application runs on the host (`npm run dev`) and connects to these containers via the ports mapped in `docker-compose.dev.yml` and configured in `.env` (copy from `.env.example`).
- Keep development configuration (`.env`) separate from production configuration; `.env` is gitignored.

## Running the stack

```
docker compose -f docker-compose.dev.yml up -d
npm run migrate   # applies pending SQL migrations from src/migrations/, idempotent
npm run dev
```

## Port notes

The Postgres container is mapped to host port **5433** (not the standard 5432) to avoid colliding with a locally-installed PostgreSQL service on developer machines. `.env.example`'s `POSTGRES_PORT=5433` matches this mapping — adjust `docker-compose.dev.yml` and `.env` together if your machine's port 5432 is free and you prefer the standard mapping.

## Tests require the stack running

`npm test` runs integration tests (`tests/integration/*.test.js`, plus DB-backed route tests) directly against the containers above — there is no mocking of Postgres/Redis/EMQX/SMTP. Bring the stack up and run `npm run migrate` once before `npm test`; Jest's `globalSetup` (`tests/global-setup.js`) also re-applies migrations idempotently at the start of every test run.

## Mailpit (email testing)

Mailpit captures all outbound SMTP mail sent by the app in development — nothing is ever delivered to a real inbox. SMTP listens on **1025** (matches `.env.example`'s `SMTP_PORT`); its web UI and REST API are on **8025** (`http://localhost:8025`). Tests use the REST API (`GET/DELETE /api/v1/messages`) to assert real email delivery instead of mocking the SMTP client.

## Frontend dev server

`frontend/` is a separate npm project (own `package.json`/lockfile). Run `cd frontend && npm install && npm run dev` to start Vite on port **5173**; its dev server proxies `/api` to `http://localhost:3000` (`frontend/vite.config.js`), so the backend must be running on its default port for the proxy to work. In production, `frontend/Dockerfile` + `frontend/nginx.conf` build and serve the static bundle instead — see `docs/architecture.md`'s Dashboard Platform section for details, including the still-open placeholder for the production Nginx→backend upstream hostname.

## MinIO (object storage)

As of Phase 11, MinIO is real infrastructure, not an unused stub — it stores uploaded firmware binaries and collected device logs. Its API listens on **9000** (matches `.env.example`'s `MINIO_ENDPOINT`/`MINIO_PORT`) and its web console on **9001** (`http://localhost:9001`, login `minioadmin`/`minioadmin` in dev — matches `docker-compose.dev.yml`'s `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`). The backend creates its bucket (`MINIO_BUCKET`, default `iot-platform`) automatically at startup (`storageClient.ensureBucket()` in `src/server.js`) — no manual bucket setup needed. Devices never talk to MinIO directly; all firmware downloads and log uploads are proxied through authenticated Express routes.
