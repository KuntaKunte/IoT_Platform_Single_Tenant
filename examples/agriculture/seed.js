// Seeds the Agriculture (soil moisture / irrigation) example. Reuses the existing
// plugins/sample-agriculture-plugin as-is — no new plugin code for this vertical.
// Requires plugins/sample-agriculture-plugin to be discovered (it is, by default,
// since PLUGINS_DIR defaults to "plugins" and that directory already exists there).
//
// Usage: node examples/agriculture/seed.js --api-url http://localhost:3000 --email you@example.com --password ...

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
    name: 'Agriculture Soil Sensor',
    defaults: {
      deviceType: 'soil-sensor',
      metadata: { category: 'agriculture', location: { lat: 52.2053, lng: 0.1218 } }
    }
  });
  console.log(`Created device template ${template.id}`);

  const device1 = await provisionDevice(apiUrl, token, { templateId: template.id, name: 'Greenhouse 1 Soil Sensor' });
  const device2 = await provisionDevice(apiUrl, token, { templateId: template.id, name: 'Greenhouse 2 Soil Sensor' });
  console.log(`Provisioned devices ${device1.id}, ${device2.id}`);

  const rule = await createRule(apiUrl, token, {
    name: 'Low soil moisture -> irrigate',
    description: 'Runs the irrigation valve for 2 minutes when soil moisture drops below 20%.',
    deviceId: device1.id,
    conditionLogic: 'all',
    conditions: [{ field: 'soilMoisture', operator: 'lt', value: 20 }],
    actions: [
      { type: 'irrigation_command', config: { durationSeconds: 120 } },
      {
        type: 'notification',
        config: {
          severity: 'warning',
          title: 'Low soil moisture — irrigation triggered',
          message: 'Soil moisture on Greenhouse 1 dropped below 20%. Irrigation has been triggered for 2 minutes.',
          channels: [{ type: 'email', recipient: 'agronomist@example.com' }]
        }
      }
    ]
  });
  console.log(`Created rule ${rule.id}`);

  const dashboardTemplate = await createDashboardTemplate(apiUrl, token, {
    name: 'Agriculture — Soil & Irrigation',
    description: 'Soil moisture, irrigation status, and device health for greenhouse soil sensors.',
    layout: [
      { id: 'soil', type: 'soil_moisture', title: 'Soil Moisture', position: { x: 0, y: 0, w: 4, h: 3 }, config: { deviceId: device1.id, metric: 'soilMoisture' } },
      { id: 'gauge', type: 'gauge', title: 'Soil Moisture %', position: { x: 4, y: 0, w: 4, h: 3 }, config: { deviceId: device1.id, metric: 'soilMoisture', min: 0, max: 60 } },
      { id: 'chart', type: 'chart', title: 'Soil Moisture Trend', position: { x: 8, y: 0, w: 4, h: 3 }, config: { deviceId: device1.id, metric: 'soilMoisture', historyLimit: 50 } },
      { id: 'status', type: 'status_card', title: 'Sensor 1 Status', position: { x: 0, y: 3, w: 4, h: 3 }, config: { deviceId: device1.id } },
      { id: 'alarms', type: 'alarm_list', title: 'Alerts', position: { x: 4, y: 3, w: 4, h: 3 }, config: { limit: 10 } },
      { id: 'map', type: 'map', title: 'Sensor Locations', position: { x: 8, y: 3, w: 4, h: 3 }, config: { deviceIds: [device1.id, device2.id] } }
    ]
  });
  const dashboard = await instantiateDashboard(apiUrl, token, dashboardTemplate.id, {
    name: 'Agriculture — Soil & Irrigation'
  });
  console.log(`Created dashboard ${dashboard.id} from template ${dashboardTemplate.id}`);

  const report = await createReport(apiUrl, token, {
    name: 'Agriculture Weekly Moisture Summary',
    description: 'Average soil moisture and temperature, with irrigation command and alert counts.',
    deviceIds: [device1.id, device2.id],
    metrics: [
      { field: 'soilMoisture', label: 'Soil Moisture %', aggregation: 'avg' },
      { field: 'temperature', label: 'Temperature C', aggregation: 'avg' }
    ],
    includeAlertSummary: true,
    includeCommandSummary: true,
    bucketInterval: 'day',
    periodDays: 7
  });
  const schedule = await createReportSchedule(apiUrl, token, report.id, {
    frequency: 'weekly',
    dayOfWeek: 1,
    hourOfDay: 8,
    recipients: ['agronomist@example.com'],
    format: 'pdf'
  });
  console.log(`Created report ${report.id} with schedule ${schedule.id}`);

  saveState(path.join(__dirname, '.seeded.json'), {
    template: template.id,
    devices: [
      { id: device1.id, name: device1.name, role: 'soil-sensor' },
      { id: device2.id, name: device2.name, role: 'soil-sensor' }
    ],
    rules: [rule.id],
    dashboardTemplate: dashboardTemplate.id,
    dashboard: dashboard.id,
    report: report.id,
    schedule: schedule.id
  });
  console.log('Wrote examples/agriculture/.seeded.json');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
