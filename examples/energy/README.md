# Energy — Smart Metering

A Phase 15 example vertical, built entirely from device templates, rules,
dashboards, and reports — pure configuration, no new plugin code. Zero
changes to core platform code.

## Scenario

A smart meter ("Substation Meter 1") reports `powerKw`, `voltage`, and a
cumulative `energyKwh`. When instantaneous power exceeds 50kW, a rule sends a
warning email and publishes an internal `demand-response` MQTT message
(illustrating a downstream load-shedding integration without making a real
outbound webhook call during simulation).

## What gets created

- **Device template**: `Energy Smart Meter` (`deviceType: smart-meter`)
- **Device**: `Substation Meter 1`
- **Rule**: `Peak demand exceeded` — `powerKw > 50` → `notification` + `mqtt_publish`
- **Dashboard**: `Energy — Substation Meter 1` — `chart`, `gauge`, `status_card`, `alarm_list`
- **Report**: `Energy Weekly Consumption` — sum of energy (kWh), peak power (kW), weekly

## Running it

Prerequisites: the platform running (`docker-compose.dev.yml` + `npm run dev`),
and an account with the `manager` or `admin` role — see `examples/README.md` if
you don't have one yet.

```bash
node examples/energy/seed.js --api-url http://localhost:3000 --email you@example.com --password ...
node examples/lib/simulate-telemetry.js --industry energy --iterations 30
```

The simulator oscillates power draw and occasionally crosses 50kW — watch the
rule fire at `GET /api/v1/rules/:ruleId/history` and the alert email land in
Mailpit (`http://localhost:8025` in the dev stack).
