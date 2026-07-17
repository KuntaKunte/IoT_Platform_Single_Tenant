import { definePlugin } from '#plugin-sdk';

// Known PLC fault codes for the Phase 15 industrial-automation example. Real
// deployments would replace this with their own PLC vendor's fault table.
const FAULT_CODES = {
  0: { label: 'OK', severity: 'none' },
  1: { label: 'E-Stop Triggered', severity: 'critical' },
  2: { label: 'Sensor Fault', severity: 'warning' },
  3: { label: 'Overtemperature', severity: 'critical' },
  4: { label: 'Communication Timeout', severity: 'warning' }
};

export default definePlugin({
  activate(api) {
    // Rule action: writes a safe-state setpoint to the PLC via a real device
    // command (e.g. stop the conveyor) when a rule condition matches a fault.
    api.registerRuleAction('plc_setpoint_write', async (config, context) => {
      const deviceId = config.deviceId ?? context.deviceId;
      return api.createDeviceCommand(deviceId, 'setpoint_write', {
        register: config.register,
        value: config.value
      });
    });

    // Dashboard widget: reads the device's most recent telemetry, pulls out a
    // numeric fault code (dot-path configurable, defaults to "faultCode"), and
    // maps it to a human label + severity for display.
    api.registerDashboardWidget('fault_code_grid', async (widget) => {
      const latest = await api.getLatestTelemetry(widget.config.deviceId);
      const code = latest ? api.getFieldValue(latest.payload, widget.config.metric || 'faultCode') : null;
      const known = FAULT_CODES[code];
      return {
        code,
        label: known ? known.label : 'Unknown',
        severity: known ? known.severity : 'warning'
      };
    });

    // Plugin-owned route, mounted at /api/v1/plugin-extensions/plc-monitoring-plugin/*
    api.router.get('/status', (_req, res) => {
      res.status(200).json({ plugin: 'plc-monitoring-plugin', ok: true });
    });

    api.logger.info('plc-monitoring-plugin activated');
  },
  deactivate() {
    // No external resources to release in this reference plugin.
  }
});
