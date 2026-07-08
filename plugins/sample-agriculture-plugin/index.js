import { definePlugin } from '#plugin-sdk';

export default definePlugin({
  activate(api) {
    // Rule action: sends a real device command when a rule condition matches
    // (e.g. "soilMoisture < 20" -> irrigate for a configured duration).
    api.registerRuleAction('irrigation_command', async (config, context) => {
      const deviceId = config.deviceId ?? context.deviceId;
      return api.createDeviceCommand(deviceId, 'irrigation', {
        durationSeconds: config.durationSeconds ?? 60
      });
    });

    // Dashboard widget: reads the device's most recent telemetry and pulls out
    // a soil-moisture reading (dot-path configurable, defaults to "soilMoisture").
    api.registerDashboardWidget('soil_moisture', async (widget) => {
      const latest = await api.getLatestTelemetry(widget.config.deviceId);
      return {
        value: latest ? api.getFieldValue(latest.payload, widget.config.metric || 'soilMoisture') : null
      };
    });

    // Plugin-owned route, mounted at /api/v1/plugin-extensions/sample-agriculture-plugin/*
    api.router.get('/status', (_req, res) => {
      res.status(200).json({ plugin: 'sample-agriculture-plugin', ok: true });
    });

    api.logger.info('sample-agriculture-plugin activated');
  },
  deactivate() {
    // No external resources to release in this reference plugin.
  }
});
