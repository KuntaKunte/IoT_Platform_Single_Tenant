import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';
import { dbClient } from '../src/shared/database.js';
import { dispatchDueReportSchedules } from '../src/modules/reports/dispatcher.js';

const MAILPIT_BASE = 'http://localhost:8025/api/v1';

async function clearMailpit() {
  await fetch(`${MAILPIT_BASE}/messages`, { method: 'DELETE' });
}

async function getMailpitMessages() {
  const response = await fetch(`${MAILPIT_BASE}/messages`);
  return response.json();
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function insertTelemetry(deviceId, temperature, receivedAt) {
  await dbClient.query(
    `INSERT INTO telemetry_history (device_id, topic, payload, received_at) VALUES ($1, $2, $3, $4)`,
    [deviceId, `devices/${deviceId}/telemetry`, JSON.stringify({ temperature }), receivedAt]
  );
}

describe('reports & analytics endpoints', () => {
  let adminToken;
  let deviceId;

  beforeEach(async () => {
    await resetDatabase();
    await clearMailpit();
    adminToken = await createAdminToken();

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Report Sensor', deviceType: 'sensor' });
    deviceId = deviceResponse.body.device.id;
  });

  function reportPayload(overrides = {}) {
    return {
      name: 'Temperature Report',
      description: 'Daily temperature summary',
      deviceIds: [deviceId],
      metrics: [{ field: 'temperature', label: 'Temperature', aggregation: 'avg' }],
      bucketInterval: 'day',
      periodDays: 7,
      ...overrides
    };
  }

  it('creates, lists, updates, and deletes a report', async () => {
    const createResponse = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload());
    expect(createResponse.status).toBe(201);
    const reportId = createResponse.body.report.id;

    const listResponse = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listResponse.body.reports.length).toBe(1);

    const updateResponse = await request(app)
      .put(`/api/v1/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload({ name: 'Renamed Report' }));
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.report.name).toBe('Renamed Report');

    const deleteResponse = await request(app)
      .delete(`/api/v1/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/api/v1/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getResponse.status).toBe(404);
  });

  it('resolves real bucketed aggregation, trend, and KPI summaries', async () => {
    const now = new Date();
    await insertTelemetry(deviceId, 20, new Date(now.getTime() - 2 * DAY_MS));
    await insertTelemetry(deviceId, 30, new Date(now.getTime() - 1 * DAY_MS));
    await insertTelemetry(deviceId, 10, new Date(now.getTime() - 10 * DAY_MS));

    const alertResponse = await request(app)
      .post('/api/v1/notifications/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Report test alert',
        message: 'test',
        deviceId,
        escalationPolicy: [{ delayMs: 0, channels: [{ type: 'email', recipient: 'ops@example.com' }] }]
      });
    await request(app)
      .post(`/api/v1/notifications/alerts/${alertResponse.body.alert.id}/ack`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId, type: 'ping' });

    const createResponse = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload());
    const reportId = createResponse.body.report.id;

    const dataResponse = await request(app)
      .get(`/api/v1/reports/${reportId}/data`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dataResponse.status).toBe(200);

    const metric = dataResponse.body.metrics[0];
    expect(metric.series.length).toBe(2);
    expect(metric.series.map((point) => point.value)).toEqual([20, 30]);
    expect(metric.trend.current).toBe(25);
    expect(metric.trend.previous).toBe(10);
    expect(metric.trend.changePercent).toBe(150);

    expect(dataResponse.body.alertSummary).toEqual([
      expect.objectContaining({ severity: 'info', count: 1 })
    ]);
    expect(dataResponse.body.alertSummary[0].avgAckSeconds).not.toBeNull();

    expect(dataResponse.body.commandSummary).toEqual([
      expect.objectContaining({ status: 'pending', count: 1 })
    ]);
  });

  it('exports a real PDF file', async () => {
    const createResponse = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload());
    const reportId = createResponse.body.report.id;

    const exportResponse = await request(app)
      .get(`/api/v1/reports/${reportId}/export?format=pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toBe('application/pdf');
    expect(exportResponse.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('exports a real, parseable Excel workbook', async () => {
    const createResponse = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload());
    const reportId = createResponse.body.report.id;

    const exportResponse = await request(app)
      .get(`/api/v1/reports/${reportId}/export?format=excel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(exportResponse.status).toBe(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResponse.body);
    const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
    expect(sheetNames).toContain('Summary');
    expect(sheetNames).toContain('Temperature');
  });

  it('creates a schedule, dispatches it, and delivers a real email with a real attachment', async () => {
    const createResponse = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload());
    const reportId = createResponse.body.report.id;

    const scheduleResponse = await request(app)
      .post(`/api/v1/reports/${reportId}/schedules`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ frequency: 'daily', hourOfDay: 8, recipients: ['ops@example.com'], format: 'pdf' });
    expect(scheduleResponse.status).toBe(201);
    const scheduleId = scheduleResponse.body.schedule.id;

    await dbClient.query("UPDATE report_schedules SET next_run_at = now() - interval '1 hour' WHERE id = $1", [
      scheduleId
    ]);

    const { dispatched } = await dispatchDueReportSchedules();
    expect(dispatched).toBe(1);

    const runsResponse = await request(app)
      .get(`/api/v1/reports/${reportId}/runs`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(runsResponse.body.runs[0].status).toBe('success');

    const scheduleAfter = await request(app)
      .get(`/api/v1/reports/${reportId}/schedules`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(new Date(scheduleAfter.body.schedules[0].next_run_at).getTime()).toBeGreaterThan(Date.now());

    const mail = await getMailpitMessages();
    expect(mail.messages_count).toBe(1);
    expect(mail.messages[0].To[0].Address).toBe('ops@example.com');
    expect(mail.messages[0].Attachments).toBe(1);
  });

  it('rejects a malformed report payload', async () => {
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Report' });
    expect(response.status).toBe(400);
  });

  it('rejects an invalid weekly schedule missing dayOfWeek', async () => {
    const createResponse = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(reportPayload());
    const reportId = createResponse.body.report.id;

    const response = await request(app)
      .post(`/api/v1/reports/${reportId}/schedules`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ frequency: 'weekly', recipients: ['ops@example.com'] });
    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated report creation', async () => {
    const response = await request(app).post('/api/v1/reports').send(reportPayload());
    expect(response.status).toBe(401);
  });

  it('rejects a viewer-role token from managing reports', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const response = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(reportPayload());
    expect(response.status).toBe(403);
  });
});
