# Agriculture — Soil Moisture & Irrigation

A Phase 15 example vertical, built entirely from device templates, rules,
dashboards, and reports — plus the existing `plugins/sample-agriculture-plugin`
(reused as-is, not modified). Zero changes to core platform code.

## Scenario

Two soil-moisture sensors ("Greenhouse 1/2 Soil Sensor") report `soilMoisture`
(%) and `temperature` (°C). When `soilMoisture` drops below 20% on Greenhouse 1,
a rule fires the plugin's `irrigation_command` action (a real device command,
2-minute irrigation run) and sends a warning-level email notification.

## What gets created

- **Device template**: `Agriculture Soil Sensor` (`deviceType: soil-sensor`)
- **Devices**: `Greenhouse 1 Soil Sensor`, `Greenhouse 2 Soil Sensor`
- **Rule**: `Low soil moisture -> irrigate` — `soilMoisture < 20` → `irrigation_command` + `notification`
- **Dashboard**: `Agriculture — Soil & Irrigation` — `soil_moisture` (plugin widget), `gauge`, `chart`, `status_card`, `alarm_list`, `map`
- **Report**: `Agriculture Weekly Moisture Summary` — avg soil moisture/temperature, weekly, with alert + irrigation-command summaries

## Running it

Prerequisites: the platform running (`docker-compose.dev.yml` + `npm run dev`),
and an account with the `manager` or `admin` role — see `examples/README.md` if
you don't have one yet.

```bash
node examples/agriculture/seed.js --api-url http://localhost:3000 --email you@example.com --password ...
node examples/lib/simulate-telemetry.js --industry agriculture --iterations 30
```

The simulator drifts `soilMoisture` down until it crosses 20%, then springs it
back up (simulating irrigation) — watch the rule fire at
`GET /api/v1/rules/:ruleId/history` and the notification email land in Mailpit
(`http://localhost:8025` in the dev stack).
