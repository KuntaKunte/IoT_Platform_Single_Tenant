# plc-monitoring-plugin

A Phase 15 example plugin — proves the Plugin Framework can carry a second,
independent vertical (Industrial Automation) alongside `sample-agriculture-plugin`,
with zero changes to the core platform. Used by `examples/industrial-automation/`.

It registers:

- **`plc_setpoint_write`** — a Rule Engine action. When a rule matches (e.g. a
  `faultCode` telemetry field goes non-zero), it sends a real `setpoint_write`
  device command via `api.createDeviceCommand`, e.g. to stop a conveyor.
- **`fault_code_grid`** — a Dashboard widget. Reads a device's latest telemetry,
  extracts a configurable field (defaults to `faultCode`), and maps it to a
  human label + severity using a small built-in fault table:

  | Code | Label                  | Severity |
  |------|-------------------------|----------|
  | 0    | OK                      | none     |
  | 1    | E-Stop Triggered        | critical |
  | 2    | Sensor Fault            | warning  |
  | 3    | Overtemperature         | critical |
  | 4    | Communication Timeout   | warning  |

- **`GET /api/v1/plugin-extensions/plc-monitoring-plugin/status`** — a trivial
  plugin-owned route proving the router extension point works.

See `plugin.json` for the manifest and `index.js` for the full (short) implementation.
