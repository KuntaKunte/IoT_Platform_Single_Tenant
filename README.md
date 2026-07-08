# IoT Platform Single Tenant

A commercial, industry-agnostic IoT platform: device management, MQTT telemetry, downlink commands, a rules engine, notifications, and a dashboard UI — built for independent per-customer deployments.

See [docs/architecture.md](docs/architecture.md) for the full module map and design rationale.

## Repository Structure

- `.github/` — GitHub workflows and templates
- `docs/` — architecture, standards, workflow, and operations documentation
- `src/` — backend application source (Express API)
- `tests/` — backend automated tests (Jest + Supertest, run against real Postgres/Redis/EMQX/Mailpit — no mocking)
- `frontend/` — dashboard frontend (React + Vite SPA)

## Local Setup

### Backend

1. Install dependencies: `npm install`
2. Copy environment variables: `copy .env.example .env` (adjust ports if they conflict with local services — see [docs/operations/docker-development.md](docs/operations/docker-development.md))
3. Start infrastructure: `docker compose -f docker-compose.dev.yml up -d` (Postgres, Redis, EMQX, MinIO, Mailpit)
4. Apply database migrations: `npm run migrate`
5. Start the API: `npm run dev` (listens on `PORT`, default 3000)
6. Run tests: `npm test` (requires the stack from step 3 to be running)

### Frontend

1. `cd frontend && npm install`
2. `npm run dev` — starts the Vite dev server on port 5173, proxying `/api` to the backend on port 3000
3. Open `http://localhost:5173` and log in with a user registered via the backend's `POST /api/v1/auth/register`

## Documentation Structure

- Architecture guidance
- Coding standards
- Development workflow
- Git strategy
- Release strategy
- Environment strategy
- ADR template and index
- Docker development and production strategy
- Project roadmap

## Git and Workflow Strategy

- Main branch is reserved for production-ready code.
- Develop branch is used for integration and planned work.
- Feature, hotfix, and chore branches should follow the documented naming conventions.
- Pull requests are required for changes to protected branches.
