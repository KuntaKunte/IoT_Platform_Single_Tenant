# Healthcare — Asset & Environmental Monitoring

A Phase 15 example vertical, built entirely from device templates, rules,
dashboards, and reports — pure configuration, no new plugin code. Zero
changes to core platform code.

## Scenario

A cold-chain fridge monitor ("Pharmacy Fridge 1") reports `temperature` and
`humidity`; an asset tag ("Infusion Pump Tag 12") reports `batteryPct`. A
temperature excursion above 8°C triggers a two-level escalation (immediate
on-call email, then a compliance email 5 minutes later if unresolved) —
demonstrating the rules engine's `escalationPolicy`, not just a flat channel
list. A low asset-tag battery triggers a separate warning to biomed.

## What gets created

- **Device templates**: `Healthcare Cold-Chain Monitor` (`deviceType: env-monitor`), `Healthcare Asset Tag` (`deviceType: asset-tag`)
- **Devices**: `Pharmacy Fridge 1`, `Infusion Pump Tag 12`
- **Rules**: `Cold-chain temperature excursion` (`temperature > 8`, two-level escalation), `Asset tag low battery` (`batteryPct < 10`)
- **Dashboard**: `Healthcare — Cold Chain & Assets` — `chart`, `gauge`, `status_card`, `alarm_list`, `map` (both devices)
- **Report**: `Healthcare Weekly Environmental & Asset Summary` — avg fridge temperature, avg asset battery, weekly

## Running it

Prerequisites: the platform running (`docker-compose.dev.yml` + `npm run dev`),
and an account with the `manager` or `admin` role — see `examples/README.md` if
you don't have one yet.

```bash
node examples/healthcare/seed.js --api-url http://localhost:3000 --email you@example.com --password ...
node examples/lib/simulate-telemetry.js --industry healthcare --iterations 30
```

The simulator reports a temperature excursion roughly 10% of ticks and drains
the asset tag battery steadily — watch both rules fire at
`GET /api/v1/rules/:ruleId/history` and the escalation and low-battery emails
land in Mailpit (`http://localhost:8025` in the dev stack).
