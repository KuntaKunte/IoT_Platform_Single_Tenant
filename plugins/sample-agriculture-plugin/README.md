# sample-agriculture-plugin

This is a **reference implementation**, not a real feature — it exists to prove the Plugin Framework end-to-end and to demonstrate the pattern industry-specific logic (agriculture, industrial automation, etc.) is meant to follow: live entirely inside a plugin, registered through the Plugin API, with zero changes to the core platform.

It registers:

- **`irrigation_command`** — a Rule Engine action. When a rule matches (e.g. a soil-moisture telemetry field drops below a threshold), it sends a real `irrigation` device command via `api.createDeviceCommand`.
- **`soil_moisture`** — a Dashboard widget. Reads a device's latest telemetry and extracts a configurable field (defaults to `soilMoisture`).
- **`GET /api/v1/plugin-extensions/sample-agriculture-plugin/status`** — a trivial plugin-owned route proving the router extension point works.

See `plugin.json` for the manifest and `index.js` for the full (short) implementation.
