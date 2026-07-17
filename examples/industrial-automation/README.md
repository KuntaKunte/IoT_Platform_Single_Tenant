# Industrial Automation — PLC Monitoring

A Phase 15 example vertical, built from device templates, rules, dashboards,
and reports, plus one new plugin: `plugins/plc-monitoring-plugin`. This is the
second real (non-reference) plugin for this platform, closing the gap flagged
in `PROGRESS.md` after Phase 12 shipped only the agriculture sample. Zero
changes to core platform code.

## Scenario

A single PLC ("Line 1 PLC") reports `faultCode` (0 = OK, 1-4 = specific
faults — see `plugins/plc-monitoring-plugin/README.md`), `cycleCount`, and
`temperature`. When `faultCode` goes non-zero, a rule writes a safe-state
setpoint (stops the conveyor) via the plugin's `plc_setpoint_write` action and
sends a critical email alert to maintenance.

## What gets created

- **Device template**: `Industrial PLC Line 1` (`deviceType: plc`)
- **Device**: `Line 1 PLC`
- **Rule**: `PLC fault detected -> stop line` — `faultCode != 0` → `plc_setpoint_write` + `notification`
- **Dashboard**: `Industrial Automation — Line 1` — `status_card`, `gauge`, `fault_code_grid` (plugin widget), `chart`, `alarm_list`
- **Report**: `Line 1 Weekly Uptime & Faults` — avg temperature, max cycle count, weekly, with alert + command summaries

## Running it

Prerequisites: the platform running with `plugins/plc-monitoring-plugin`
discovered (it is, by default — check the startup logs for "plc-monitoring-plugin
activated"), and an account with the `manager` or `admin` role — see
`examples/README.md` if you don't have one yet.

```bash
node examples/industrial-automation/seed.js --api-url http://localhost:3000 --email you@example.com --password ...
node examples/lib/simulate-telemetry.js --industry industrial-automation --iterations 30
```

The simulator reports `faultCode: 0` most ticks with a ~12% chance of a random
fault each round — watch the rule fire at `GET /api/v1/rules/:ruleId/history`,
a `setpoint_write` command appear at `GET /api/v1/commands/devices/:deviceId`, and the alert
email land in Mailpit (`http://localhost:8025` in the dev stack).
