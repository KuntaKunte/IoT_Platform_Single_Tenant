// Seeds the Water (tank and pump monitoring) example. Pure configuration — no
// new plugin code; the scenario fits entirely inside existing generic action/widget types.
//
// Usage: node examples/water/seed.js --api-url http://localhost:3000 --email you@example.com --password ...

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
    name: 'Water Tank Monitor',
    defaults: { deviceType: 'tank-monitor', metadata: { category: 'water' } }
  });
  console.log(`Created device template ${template.id}`);

  const device = await provisionDevice(apiUrl, token, { templateId: template.id, name: 'Reservoir Tank 1' });
  console.log(`Provisioned device ${device.id}`);

  const lowRule = await createRule(apiUrl, token, {
    name: 'Low tank level -> start pump',
    description: 'Starts the fill pump and alerts operations when tank level drops below 15%.',
    deviceId: device.id,
    conditionLogic: 'all',
    conditions: [{ field: 'tankLevelPct', operator: 'lt', value: 15 }],
    actions: [
      { type: 'device_command', config: { type: 'pump_control', payload: { state: 'on' } } },
      {
        type: 'notification',
        config: {
          severity: 'warning',
          title: 'Tank level low — pump started',
          message: 'Reservoir Tank 1 dropped below 15%. The fill pump has been started automatically.',
          channels: [{ type: 'email', recipient: 'water-ops@example.com' }]
        }
      }
    ]
  });

  const highRule = await createRule(apiUrl, token, {
    name: 'High tank level -> stop pump',
    description: 'Stops the fill pump once tank level exceeds 95%.',
    deviceId: device.id,
    conditionLogic: 'all',
    conditions: [{ field: 'tankLevelPct', operator: 'gt', value: 95 }],
    actions: [{ type: 'device_command', config: { type: 'pump_control', payload: { state: 'off' } } }]
  });
  console.log(`Created rules ${lowRule.id}, ${highRule.id}`);

  const dashboardTemplate = await createDashboardTemplate(apiUrl, token, {
    name: 'Water — Reservoir Tank 1',
    description: 'Tank level, flow rate, and pump status for Reservoir Tank 1.',
    layout: [
      { id: 'gauge', type: 'gauge', title: 'Tank Level %', position: { x: 0, y: 0, w: 4, h: 3 }, config: { deviceId: device.id, metric: 'tankLevelPct', min: 0, max: 100 } },
      { id: 'status', type: 'status_card', title: 'Tank Status', position: { x: 4, y: 0, w: 4, h: 3 }, config: { deviceId: device.id } },
      { id: 'chart', type: 'chart', title: 'Tank Level Trend', position: { x: 8, y: 0, w: 4, h: 3 }, config: { deviceId: device.id, metric: 'tankLevelPct', historyLimit: 50 } },
      { id: 'alarms', type: 'alarm_list', title: 'Alerts', position: { x: 0, y: 3, w: 12, h: 3 }, config: { limit: 10 } }
    ]
  });
  const dashboard = await instantiateDashboard(apiUrl, token, dashboardTemplate.id, {
    name: 'Water — Reservoir Tank 1'
  });
  console.log(`Created dashboard ${dashboard.id} from template ${dashboardTemplate.id}`);

  const report = await createReport(apiUrl, token, {
    name: 'Water Weekly Tank & Pump Summary',
    description: 'Average tank level and flow rate, with pump-cycling command counts.',
    deviceIds: [device.id],
    metrics: [
      { field: 'tankLevelPct', label: 'Avg Tank Level %', aggregation: 'avg' },
      { field: 'flowRateLpm', label: 'Avg Flow Rate L/min', aggregation: 'avg' }
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
    recipients: ['water-ops@example.com'],
    format: 'pdf'
  });
  console.log(`Created report ${report.id} with schedule ${schedule.id}`);

  saveState(path.join(__dirname, '.seeded.json'), {
    template: template.id,
    devices: [{ id: device.id, name: device.name, role: 'tank-monitor' }],
    rules: [lowRule.id, highRule.id],
    dashboardTemplate: dashboardTemplate.id,
    dashboard: dashboard.id,
    report: report.id,
    schedule: schedule.id
  });
  console.log('Wrote examples/water/.seeded.json');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
