// Seeds the Healthcare (asset and environmental monitoring) example. Pure
// configuration — no new plugin code; the scenario fits entirely inside
// existing generic action/widget types.
//
// Usage: node examples/healthcare/seed.js --api-url http://localhost:3000 --email you@example.com --password ...

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

  const envTemplate = await createDeviceTemplate(apiUrl, token, {
    name: 'Healthcare Cold-Chain Monitor',
    defaults: {
      deviceType: 'env-monitor',
      metadata: { category: 'healthcare', location: { lat: 51.5074, lng: -0.1278 } }
    }
  });
  const assetTemplate = await createDeviceTemplate(apiUrl, token, {
    name: 'Healthcare Asset Tag',
    defaults: {
      deviceType: 'asset-tag',
      metadata: { category: 'healthcare', location: { lat: 51.5074, lng: -0.1278 } }
    }
  });
  console.log(`Created device templates ${envTemplate.id}, ${assetTemplate.id}`);

  const fridge = await provisionDevice(apiUrl, token, { templateId: envTemplate.id, name: 'Pharmacy Fridge 1' });
  const assetTag = await provisionDevice(apiUrl, token, { templateId: assetTemplate.id, name: 'Infusion Pump Tag 12' });
  console.log(`Provisioned devices ${fridge.id}, ${assetTag.id}`);

  const excursionRule = await createRule(apiUrl, token, {
    name: 'Cold-chain temperature excursion',
    description: 'Escalates to on-call, then compliance, when fridge temperature exceeds 8C.',
    deviceId: fridge.id,
    conditionLogic: 'all',
    conditions: [{ field: 'temperature', operator: 'gt', value: 8 }],
    actions: [
      {
        type: 'notification',
        config: {
          severity: 'critical',
          title: 'Cold-chain temperature excursion',
          message: 'Pharmacy Fridge 1 exceeded 8C. Immediate check required to protect cold-chain stock.',
          escalationPolicy: [
            { delayMs: 0, channels: [{ type: 'email', recipient: 'pharmacy-oncall@example.com' }] },
            { delayMs: 300000, channels: [{ type: 'email', recipient: 'compliance@example.com' }] }
          ]
        }
      }
    ]
  });

  const batteryRule = await createRule(apiUrl, token, {
    name: 'Asset tag low battery',
    description: 'Alerts biomed when an asset tag battery drops below 10%.',
    deviceId: assetTag.id,
    conditionLogic: 'all',
    conditions: [{ field: 'batteryPct', operator: 'lt', value: 10 }],
    actions: [
      {
        type: 'notification',
        config: {
          severity: 'warning',
          title: 'Asset tag battery low',
          message: 'Infusion Pump Tag 12 battery dropped below 10%. Replace or recharge soon.',
          channels: [{ type: 'email', recipient: 'biomed@example.com' }]
        }
      }
    ]
  });
  console.log(`Created rules ${excursionRule.id}, ${batteryRule.id}`);

  const dashboardTemplate = await createDashboardTemplate(apiUrl, token, {
    name: 'Healthcare — Cold Chain & Assets',
    description: 'Fridge temperature, asset battery, and locations for tracked healthcare equipment.',
    layout: [
      { id: 'chart', type: 'chart', title: 'Fridge Temperature Trend', position: { x: 0, y: 0, w: 4, h: 3 }, config: { deviceId: fridge.id, metric: 'temperature', historyLimit: 50 } },
      { id: 'gauge', type: 'gauge', title: 'Fridge Temperature', position: { x: 4, y: 0, w: 4, h: 3 }, config: { deviceId: fridge.id, metric: 'temperature', min: 0, max: 15 } },
      { id: 'status', type: 'status_card', title: 'Fridge Status', position: { x: 8, y: 0, w: 4, h: 3 }, config: { deviceId: fridge.id } },
      { id: 'alarms', type: 'alarm_list', title: 'Alerts', position: { x: 0, y: 3, w: 6, h: 3 }, config: { limit: 10 } },
      { id: 'map', type: 'map', title: 'Equipment Locations', position: { x: 6, y: 3, w: 6, h: 3 }, config: { deviceIds: [fridge.id, assetTag.id] } }
    ]
  });
  const dashboard = await instantiateDashboard(apiUrl, token, dashboardTemplate.id, {
    name: 'Healthcare — Cold Chain & Assets'
  });
  console.log(`Created dashboard ${dashboard.id} from template ${dashboardTemplate.id}`);

  const report = await createReport(apiUrl, token, {
    name: 'Healthcare Weekly Environmental & Asset Summary',
    description: 'Average fridge temperature and average asset battery level, with alert counts.',
    deviceIds: [fridge.id, assetTag.id],
    metrics: [
      { field: 'temperature', label: 'Avg Fridge Temp C', aggregation: 'avg' },
      { field: 'batteryPct', label: 'Avg Asset Battery %', aggregation: 'avg' }
    ],
    includeAlertSummary: true,
    includeCommandSummary: false,
    bucketInterval: 'day',
    periodDays: 7
  });
  const schedule = await createReportSchedule(apiUrl, token, report.id, {
    frequency: 'weekly',
    dayOfWeek: 1,
    hourOfDay: 6,
    recipients: ['compliance@example.com'],
    format: 'pdf'
  });
  console.log(`Created report ${report.id} with schedule ${schedule.id}`);

  saveState(path.join(__dirname, '.seeded.json'), {
    templates: [envTemplate.id, assetTemplate.id],
    devices: [
      { id: fridge.id, name: fridge.name, role: 'env-monitor' },
      { id: assetTag.id, name: assetTag.name, role: 'asset-tag' }
    ],
    rules: [excursionRule.id, batteryRule.id],
    dashboardTemplate: dashboardTemplate.id,
    dashboard: dashboard.id,
    report: report.id,
    schedule: schedule.id
  });
  console.log('Wrote examples/healthcare/.seeded.json');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
