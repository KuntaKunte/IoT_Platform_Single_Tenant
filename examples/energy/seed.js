// Seeds the Energy (smart metering) example. Pure configuration — no new
// plugin code; the scenario fits entirely inside existing generic action/widget types.
//
// Usage: node examples/energy/seed.js --api-url http://localhost:3000 --email you@example.com --password ...

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
    name: 'Energy Smart Meter',
    defaults: { deviceType: 'smart-meter', metadata: { category: 'energy' } }
  });
  console.log(`Created device template ${template.id}`);

  const device = await provisionDevice(apiUrl, token, { templateId: template.id, name: 'Substation Meter 1' });
  console.log(`Provisioned device ${device.id}`);

  const rule = await createRule(apiUrl, token, {
    name: 'Peak demand exceeded',
    description: 'Alerts and publishes an internal demand-response signal when instantaneous power exceeds 50kW.',
    deviceId: device.id,
    conditionLogic: 'all',
    conditions: [{ field: 'powerKw', operator: 'gt', value: 50 }],
    actions: [
      {
        type: 'notification',
        config: {
          severity: 'warning',
          title: 'Peak demand threshold exceeded',
          message: 'Substation Meter 1 reported instantaneous power above 50kW.',
          channels: [{ type: 'email', recipient: 'energy-ops@example.com' }]
        }
      },
      { type: 'mqtt_publish', config: { topic: 'devices/{deviceId}/commands/demand-response', payload: { action: 'shed_load' } } }
    ]
  });
  console.log(`Created rule ${rule.id}`);

  const dashboardTemplate = await createDashboardTemplate(apiUrl, token, {
    name: 'Energy — Substation Meter 1',
    description: 'Power draw, demand trend, and meter health for Substation Meter 1.',
    layout: [
      { id: 'chart', type: 'chart', title: 'Power Trend', position: { x: 0, y: 0, w: 6, h: 3 }, config: { deviceId: device.id, metric: 'powerKw', historyLimit: 50 } },
      { id: 'gauge', type: 'gauge', title: 'Instantaneous Power (kW)', position: { x: 6, y: 0, w: 3, h: 3 }, config: { deviceId: device.id, metric: 'powerKw', min: 0, max: 80 } },
      { id: 'status', type: 'status_card', title: 'Meter Status', position: { x: 9, y: 0, w: 3, h: 3 }, config: { deviceId: device.id } },
      { id: 'alarms', type: 'alarm_list', title: 'Alerts', position: { x: 0, y: 3, w: 12, h: 3 }, config: { limit: 10 } }
    ]
  });
  const dashboard = await instantiateDashboard(apiUrl, token, dashboardTemplate.id, {
    name: 'Energy — Substation Meter 1'
  });
  console.log(`Created dashboard ${dashboard.id} from template ${dashboardTemplate.id}`);

  const report = await createReport(apiUrl, token, {
    name: 'Energy Weekly Consumption',
    description: 'Total energy consumed and peak power draw for Substation Meter 1.',
    deviceIds: [device.id],
    metrics: [
      { field: 'energyKwh', label: 'Energy kWh', aggregation: 'sum' },
      { field: 'powerKw', label: 'Peak Power kW', aggregation: 'max' }
    ],
    includeAlertSummary: true,
    includeCommandSummary: false,
    bucketInterval: 'day',
    periodDays: 7
  });
  const schedule = await createReportSchedule(apiUrl, token, report.id, {
    frequency: 'weekly',
    dayOfWeek: 1,
    hourOfDay: 7,
    recipients: ['energy-ops@example.com'],
    format: 'pdf'
  });
  console.log(`Created report ${report.id} with schedule ${schedule.id}`);

  saveState(path.join(__dirname, '.seeded.json'), {
    template: template.id,
    devices: [{ id: device.id, name: device.name, role: 'smart-meter' }],
    rules: [rule.id],
    dashboardTemplate: dashboardTemplate.id,
    dashboard: dashboard.id,
    report: report.id,
    schedule: schedule.id
  });
  console.log('Wrote examples/energy/.seeded.json');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
