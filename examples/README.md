# Example Industry Solutions (Phase 15)

Five reference verticals proving the platform's core claim: industry-specific
logic is added through **device templates, rules, dashboards, reports, plugins,
and configuration** — never by changing `src/`. Nothing under `src/` was
touched to build any of these; every example is either pure data applied
through the real REST API, or (for Agriculture and Industrial Automation) a
small plugin under `plugins/`.

| Vertical | Directory | Plugin used |
|---|---|---|
| 🌱 Agriculture (soil moisture, irrigation) | `examples/agriculture/` | `plugins/sample-agriculture-plugin` (existing, reused) |
| 🏭 Industrial Automation (PLC monitoring) | `examples/industrial-automation/` | `plugins/plc-monitoring-plugin` (new) |
| ⚡ Energy (smart metering) | `examples/energy/` | none — pure config |
| 🚰 Water (tank and pump monitoring) | `examples/water/` | none — pure config |
| 🏥 Healthcare (asset and environmental monitoring) | `examples/healthcare/` | none — pure config |

## Prerequisites

1. The platform running against the dev stack: `docker-compose.dev.yml` up, then `npm run migrate` and `npm run dev` (see the repo's top-level README for the full dev setup).
2. An account with the `manager` or `admin` role. New registrations default to
   `viewer` (`src/modules/auth/services/auth-service.js`) — there is no
   self-service elevation endpoint by design. Register, then promote directly
   in the database (the same mechanism this repo's own test helpers use):

   ```bash
   curl -s -X POST http://localhost:3000/api/v1/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"email":"you@example.com","password":"YourPassword123!"}'

   docker compose -f docker-compose.dev.yml exec postgres \
     psql -U iot_user -d iot_platform \
     -c "UPDATE users SET roles = '{manager}' WHERE email = 'you@example.com';"
   ```

## Running any example

Each industry follows the same two-step pattern:

```bash
node examples/<industry>/seed.js --api-url http://localhost:3000 --email you@example.com --password YourPassword123!
node examples/lib/simulate-telemetry.js --industry <industry> --iterations 30
```

`seed.js` creates the device template(s), provisions example device(s), creates
the rule(s), a dashboard template + instance, and a report + weekly schedule —
entirely via the real API — and writes the resulting IDs to a gitignored
`examples/<industry>/.seeded.json`.

`simulate-telemetry.js` then publishes realistic synthetic telemetry to the
real MQTT broker for those devices on a loop (see `examples/lib/telemetry-profiles.js`
for the per-industry generators), so the rules actually fire and the
dashboards/reports have live data — not just accepted configuration. Drop
`--iterations` to run continuously for a live demo (Ctrl+C to stop).

## Verifying a run

- `GET /api/v1/dashboards/:dashboardId/data` — live widget values.
- `GET /api/v1/rules/:ruleId/history` — confirms a rule's conditions actually matched and which actions fired.
- Mailpit at `http://localhost:8025` (part of the dev stack) — every example's `notification` actions use the `email` channel, so alerts are visible here without any extra setup.
- `GET /api/v1/reports/:reportId/data` and `GET /api/v1/reports/:reportId/export?format=pdf` — real aggregated output.

See each industry's own `README.md` for its specific scenario, field names, and expected behavior.
