import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';
import { dispatchDueNotifications } from '../src/modules/notifications/services/notification-service.js';
import { dbClient } from '../src/shared/database.js';

const MAILPIT_BASE = 'http://localhost:8025/api/v1';

async function clearMailpit() {
  await fetch(`${MAILPIT_BASE}/messages`, { method: 'DELETE' });
}

async function getMailpitMessages() {
  const response = await fetch(`${MAILPIT_BASE}/messages`);
  return response.json();
}

describe('notification platform endpoints', () => {
  let adminToken;

  beforeEach(async () => {
    await resetDatabase();
    await clearMailpit();
    adminToken = await createAdminToken();
  });

  async function createAlert(overrides = {}) {
    return request(app)
      .post('/api/v1/notifications/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'High temperature alert',
        message: 'Sensor exceeded threshold',
        escalationPolicy: [{ delayMs: 0, channels: [{ type: 'email', recipient: 'ops@example.com' }] }],
        ...overrides
      });
  }

  it('dispatches an immediate email delivery for real via Mailpit', async () => {
    const createResponse = await createAlert();
    expect(createResponse.status).toBe(201);
    const alertId = createResponse.body.alert.id;

    await dispatchDueNotifications();

    const deliveriesResponse = await request(app)
      .get(`/api/v1/notifications/alerts/${alertId}/deliveries`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deliveriesResponse.body.deliveries[0].status).toBe('sent');

    const mail = await getMailpitMessages();
    expect(mail.messages_count).toBe(1);
    expect(mail.messages[0].To[0].Address).toBe('ops@example.com');
    expect(mail.messages[0].Subject).toBe('High temperature alert');
  });

  it('escalates to the next level when not acknowledged, and stops after acknowledgement', async () => {
    const createResponse = await createAlert({
      escalationPolicy: [
        { delayMs: 0, channels: [{ type: 'email', recipient: 'ops@example.com' }] },
        { delayMs: 999999, channels: [{ type: 'sms', recipient: '+15550000000' }] }
      ]
    });
    const alertId = createResponse.body.alert.id;

    await dispatchDueNotifications();

    await dbClient.query("UPDATE alerts SET next_escalation_at = now() - interval '1 hour' WHERE id = $1", [
      alertId
    ]);
    await dispatchDueNotifications();

    const deliveriesResponse = await request(app)
      .get(`/api/v1/notifications/alerts/${alertId}/deliveries`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deliveriesResponse.body.deliveries.length).toBe(2);

    const escalatedAlertResponse = await request(app)
      .get(`/api/v1/notifications/alerts/${alertId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(escalatedAlertResponse.body.alert.escalation_level).toBe(1);

    const ackResponse = await request(app)
      .post(`/api/v1/notifications/alerts/${alertId}/ack`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ackResponse.status).toBe(200);
    expect(ackResponse.body.alert.status).toBe('acknowledged');

    await dbClient.query("UPDATE alerts SET next_escalation_at = now() - interval '1 hour' WHERE id = $1", [
      alertId
    ]);
    await dispatchDueNotifications();

    const finalDeliveriesResponse = await request(app)
      .get(`/api/v1/notifications/alerts/${alertId}/deliveries`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(finalDeliveriesResponse.body.deliveries.length).toBe(2);
  });

  it('renders a template for the delivered email', async () => {
    const templateResponse = await request(app)
      .post('/api/v1/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'device-alert-template',
        bodyTemplate: 'Device {{deviceName}} reported {{value}} degrees'
      });
    expect(templateResponse.status).toBe(201);
    const templateId = templateResponse.body.template.id;

    const createResponse = await createAlert({
      templateId,
      templateData: { deviceName: 'Gateway-01', value: 42 }
    });
    const alertId = createResponse.body.alert.id;

    await dispatchDueNotifications();

    const mail = await getMailpitMessages();
    expect(mail.messages[0].Snippet).toContain('Gateway-01');

    const deliveriesResponse = await request(app)
      .get(`/api/v1/notifications/alerts/${alertId}/deliveries`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deliveriesResponse.body.deliveries[0].status).toBe('sent');
  });

  it('marks a delivery failed after exhausting retries against a failing webhook', async () => {
    const http = await import('http');
    const server = http.createServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    const createResponse = await createAlert({
      escalationPolicy: [
        { delayMs: 0, channels: [{ type: 'webhook', recipient: `http://127.0.0.1:${port}/hook` }] }
      ]
    });
    const alertId = createResponse.body.alert.id;

    await dispatchDueNotifications();
    let deliveries = (
      await request(app).get(`/api/v1/notifications/alerts/${alertId}/deliveries`).set('Authorization', `Bearer ${adminToken}`)
    ).body.deliveries;
    await dbClient.query('UPDATE notification_deliveries SET next_attempt_at = now() WHERE id = $1', [
      deliveries[0].id
    ]);
    await dispatchDueNotifications();
    await dbClient.query('UPDATE notification_deliveries SET next_attempt_at = now() WHERE id = $1', [
      deliveries[0].id
    ]);
    await dispatchDueNotifications();

    deliveries = (
      await request(app).get(`/api/v1/notifications/alerts/${alertId}/deliveries`).set('Authorization', `Bearer ${adminToken}`)
    ).body.deliveries;
    expect(deliveries[0].status).toBe('failed');

    await new Promise((resolve) => server.close(resolve));
  });

  it('rejects an alert for an unknown device', async () => {
    const response = await createAlert({ deviceId: 999999 });
    expect(response.status).toBe(404);
  });

  it('rejects a malformed alert payload', async () => {
    const response = await request(app)
      .post('/api/v1/notifications/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Missing message and policy' });
    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated alert creation', async () => {
    const response = await request(app).post('/api/v1/notifications/alerts').send({ title: 'x' });
    expect(response.status).toBe(401);
  });

  it('rejects a viewer-role token from managing notifications', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const response = await request(app)
      .post('/api/v1/notifications/alerts')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Should fail',
        message: 'x',
        escalationPolicy: [{ delayMs: 0, channels: [{ type: 'email', recipient: 'x@example.com' }] }]
      });
    expect(response.status).toBe(403);
  });
});
