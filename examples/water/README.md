# Water — Tank & Pump Monitoring

A Phase 15 example vertical, built entirely from device templates, rules,
dashboards, and reports — pure configuration, no new plugin code. Zero
changes to core platform code.

## Scenario

A tank monitor ("Reservoir Tank 1") reports `tankLevelPct`, `flowRateLpm`,
and `pumpRunning`. Two rules bracket the fill cycle: below 15% the fill pump
starts (a real `pump_control` device command) and operations is emailed;
above 95% the pump stops.

## What gets created

- **Device template**: `Water Tank Monitor` (`deviceType: tank-monitor`)
- **Device**: `Reservoir Tank 1`
- **Rules**: `Low tank level -> start pump` (`tankLevelPct < 15`), `High tank level -> stop pump` (`tankLevelPct > 95`)
- **Dashboard**: `Water — Reservoir Tank 1` — `gauge`, `status_card`, `chart`, `alarm_list`
- **Report**: `Water Weekly Tank & Pump Summary` — avg tank level, avg flow rate, weekly, with pump-command counts

## Running it

Prerequisites: the platform running (`docker-compose.dev.yml` + `npm run dev`),
and an account with the `manager` or `admin` role — see `examples/README.md` if
you don't have one yet.

```bash
node examples/water/seed.js --api-url http://localhost:3000 --email you@example.com --password ...
node examples/lib/simulate-telemetry.js --industry water --iterations 30
```

The simulator sawtooths tank level between the two thresholds — watch both
rules fire at `GET /api/v1/rules/:ruleId/history`, `pump_control` commands
appear at `GET /api/v1/commands/devices/:deviceId`, and the low-level alert
email land in Mailpit (`http://localhost:8025` in the dev stack).
