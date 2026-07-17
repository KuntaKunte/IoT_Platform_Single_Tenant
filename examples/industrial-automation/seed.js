// Seeds the Industrial Automation (PLC monitoring) example. Uses the new
// plugins/plc-monitoring-plugin for a custom rule action (plc_setpoint_write)
// and dashboard widget (fault_code_grid) — the second real, non-reference
// plugin for this platform.
//
// Usage: node examples/industrial-automation/seed.js --api-url http://localhost:3000 --email you@example.com --password ...

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  parseArgs,
  login,
  createDeviceTemplate,
  provisionDevice,
  createRule,
  createDashboardTemplate,
  instantiateDashboard,
  createReport,
  createReportSchedule,
  saveState
} from '../lib/seed-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { apiUrl, email, password } = parseArgs(process.argv.slice(2));
  const token = await login(apiUrl, email, password);
  console.log('Logged in.');

  const template = await createDeviceTemplate(apiUrl, token, {
    name: 'Industrial PLC Line 1',
    defaults: { deviceType: 'plc', metadata: { category: 'industrial', line: 'Line 1' } }
  });
  console.log(`Created device template ${template.id}`);

  const device = await provisionDevice(apiUrl, token, { templateId: template.id, name: 'Line 1 PLC' });
  console.log(`Provisioned device ${device.id}`);

  const rule = await createRule(apiUrl, token, {
    name: 'PLC fault detected -> stop line',
    description: 'Writes a safe-state setpoint (stop conveyor) and alerts maintenance when a fault code is reported.',
    deviceId: device.id,
    conditionLogic: 'all',
    conditions: [{ field: 'faultCode', operator: 'neq', value: 0 }],
    actions: [
      { type: 'plc_setpoint_write', config: { register: 'conveyor_speed', value: 0 } },
      {
        type: 'notification',
        config: {
          severity: 'critical',
          title: 'PLC fault detected — line stopped',
          message: 'Line 1 PLC reported a non-zero fault code. The conveyor setpoint was written to 0 (stopped) automatically.',
          channels: [{ type: 'email', recipient: 'maintenance@example.com' }]
        }
      }
    ]
  });
  console.log(`Created rule ${rule.id}`);

  const dashboardTemplate = await createDashboardTemplate(apiUrl, token, {
    name: 'Industrial Automation — Line 1',
    description: 'Fault status, cycle count, and temperature for the Line 1 PLC.',
    layout: [
      { id: 'status', type: 'status_card', title: 'Line 1 Status', position: { x: 0, y: 0, w: 4, h: 3 }, config: { deviceId: device.id } },
      { id: 'gauge', type: 'gauge', title: 'Temperature', position: { x: 4, y: 0, w: 4, h: 3 }, config: { deviceId: device.id, metric: 'temperature', min: 30, max: 90 } },
      { id: 'fault', type: 'fault_code_grid', title: 'Fault Code', position: { x: 8, y: 0, w: 4, h: 3 }, config: { deviceId: device.id, metric: 'faultCode' } },
      { id: 'chart', type: 'chart', title: 'Temperature Trend', position: { x: 0, y: 3, w: 6, h: 3 }, config: { deviceId: device.id, metric: 'temperature', historyLimit: 50 } },
      { id: 'alarms', type: 'alarm_list', title: 'Alerts', position: { x: 6, y: 3, w: 6, h: 3 }, config: { limit: 10 } }
    ]
  });
  const dashboard = await instantiateDashboard(apiUrl, token, dashboardTemplate.id, {
    name: 'Industrial Automation — Line 1'
  });
  console.log(`Created dashboard ${dashboard.id} from template ${dashboardTemplate.id}`);

  const report = await createReport(apiUrl, token, {
    name: 'Line 1 Weekly Uptime & Faults',
    description: 'Average temperature, peak cycle count, and fault/command counts for Line 1.',
    deviceIds: [device.id],
    metrics: [
      { field: 'temperature', label: 'Avg Temperature C', aggregation: 'avg' },
      { field: 'cycleCount', label: 'Max Cycle Count', aggregation: 'max' }
    ],
    includeAlertSummary: true,
    includeCommandSummary: true,
    bucketInterval: 'day',
    periodDays: 7
  });
  const schedule = await createReportSchedule(apiUrl, token, report.id, {
    frequency: 'weekly',
    dayOfWeek: 1,
    hourOfDay: 6,
    recipients: ['maintenance@example.com'],
    format: 'pdf'
  });
  console.log(`Created report ${report.id} with schedule ${schedule.id}`);

  saveState(path.join(__dirname, '.seeded.json'), {
    template: template.id,
    devices: [{ id: device.id, name: device.name, role: 'plc' }],
    rules: [rule.id],
    dashboardTemplate: dashboardTemplate.id,
    dashboard: dashboard.id,
    report: report.id,
    schedule: schedule.id
  });
  console.log('Wrote examples/industrial-automation/.seeded.json');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
