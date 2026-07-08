import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';
import { createTelemetryWorker } from '../src/modules/mqtt/worker.js';
import { redisClient } from '../src/shared/redis.js';

describe('dashboard platform endpoints', () => {
  let adminToken;
  let deviceId;
  let deviceApiKey;
  let alertId;
  let worker;

  beforeEach(async () => {
    await resetDatabase();
    await redisClient.del('iot:queue:telemetry');
    adminToken = await createAdminToken();
    worker = createTelemetryWorker();

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Dashboard Sensor', deviceType: 'sensor', metadata: { location: { lat: 51.5, lng: -0.1 } } });
    deviceId = deviceResponse.body.device.id;

    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'dashboard-device-key', roles: ['device'] });
    deviceApiKey = apiKeyResponse.body.apiKey;

    await request(app)
      .post('/api/v1/mqtt/telemetry')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, topic: `devices/${deviceId}/telemetry`, payload: { temperature: 25 } });
    await worker.runOnce();

    const alertResponse = await request(app)
      .post('/api/v1/notifications/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Dashboard test alert',
        message: 'test',
        deviceId,
        escalationPolicy: [{ delayMs: 0, channels: [{ type: 'email', recipient: 'ops@example.com' }] }]
      });
    alertId = alertResponse.body.alert.id;
  });

  function widgetLayout() {
    return [
      {
        id: 'w-chart',
        type: 'chart',
        title: 'Temperature Chart',
        position: { x: 0, y: 0, w: 4, h: 2 },
        config: { deviceId, metric: 'temperature' }
      },
      {
        id: 'w-gauge',
        type: 'gauge',
        title: 'Temperature Gauge',
        position: { x: 4, y: 0, w: 2, h: 2 },
        config: { deviceId, metric: 'temperature', min: 0, max: 100 }
      },
      {
        id: 'w-status',
        type: 'status_card',
        title: 'Device Status',
        position: { x: 0, y: 2, w: 2, h: 1 },
        config: { deviceId }
      },
      {
        id: 'w-alarms',
        type: 'alarm_list',
        title: 'Active Alarms',
        position: { x: 2, y: 2, w: 4, h: 2 },
        config: { limit: 10 }
      },
      {
        id: 'w-map',
        type: 'map',
        title: 'Device Map',
        position: { x: 0, y: 3, w: 6, h: 3 },
        config: { deviceIds: [deviceId] }
      }
    ];
  }

  it('creates a dashboard and resolves real data for every widget type', async () => {
    const createResponse = await request(app)
      .post('/api/v1/dashboards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Sensor Overview', layout: widgetLayout() });
    expect(createResponse.status).toBe(201);
    const dashboardId = createResponse.body.dashboard.id;

    const dataResponse = await request(app)
      .get(`/api/v1/dashboards/${dashboardId}/data`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dataResponse.status).toBe(200);

    const byId = Object.fromEntries(dataResponse.body.widgets.map((w) => [w.id, w]));
    expect(byId['w-chart'].data).toEqual([expect.objectContaining({ value: 25 })]);
    expect(byId['w-gauge'].data).toEqual({ value: 25, min: 0, max: 100 });
    expect(byId['w-status'].data).toMatchObject({ deviceId, online: true });
    expect(byId['w-alarms'].data.some((alert) => alert.id === alertId)).toBe(true);
    expect(byId['w-map'].data).toEqual([{ deviceId, name: 'Dashboard Sensor', lat: 51.5, lng: -0.1 }]);
  });

  it('creates a dashboard template and instantiates it', async () => {
    const templateResponse = await request(app)
      .post('/api/v1/dashboards/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Basic Template', layout: [widgetLayout()[2]] });
    expect(templateResponse.status).toBe(201);
    const templateId = templateResponse.body.template.id;

    const instantiateResponse = await request(app)
      .post(`/api/v1/dashboards/templates/${templateId}/instantiate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'From Template' });
    expect(instantiateResponse.status).toBe(201);
    expect(instantiateResponse.body.dashboard.layout).toEqual([widgetLayout()[2]]);
  });

  it('updates and deletes a dashboard', async () => {
    const createResponse = await request(app)
      .post('/api/v1/dashboards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'To Rename', layout: [] });
    const dashboardId = createResponse.body.dashboard.id;

    const updateResponse = await request(app)
      .put(`/api/v1/dashboards/${dashboardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed', layout: [widgetLayout()[2]] });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.dashboard.name).toBe('Renamed');

    const deleteResponse = await request(app)
      .delete(`/api/v1/dashboards/${dashboardId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app)
      .get(`/api/v1/dashboards/${dashboardId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getResponse.status).toBe(404);
  });

  it('rejects a malformed dashboard payload', async () => {
    const response = await request(app)
      .post('/api/v1/dashboards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ layout: [{ type: 'chart' }] });
    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated dashboard creation', async () => {
    const response = await request(app).post('/api/v1/dashboards').send({ name: 'x' });
    expect(response.status).toBe(401);
  });

  it('rejects a viewer-role token from managing dashboards', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const response = await request(app)
      .post('/api/v1/dashboards')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Should fail', layout: [] });
    expect(response.status).toBe(403);
  });
});
