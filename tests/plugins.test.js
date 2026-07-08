import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';
import { loadAndActivatePlugins } from '../src/plugins/loader.js';
import { createTelemetryWorker } from '../src/modules/mqtt/worker.js';
import { redisClient } from '../src/shared/redis.js';

const PLUGIN_NAME = 'sample-agriculture-plugin';

describe('plugin framework', () => {
  let adminToken;
  let deviceId;
  let deviceApiKey;
  let worker;

  beforeEach(async () => {
    await resetDatabase();
    await redisClient.del('iot:queue:telemetry');
    adminToken = await createAdminToken();
    worker = createTelemetryWorker();

    await loadAndActivatePlugins(app);

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Plugin Test Sensor', deviceType: 'sensor' });
    deviceId = deviceResponse.body.device.id;

    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'plugin-device-key', roles: ['device'] });
    deviceApiKey = apiKeyResponse.body.apiKey;
  });

  async function publishSoilMoisture(value) {
    await request(app)
      .post('/api/v1/mqtt/telemetry')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, topic: `devices/${deviceId}/telemetry`, payload: { soilMoisture: value } });
    await worker.runOnce();
  }

  async function createIrrigationRule() {
    const response = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Low soil moisture irrigation',
        deviceId,
        conditions: [{ field: 'soilMoisture', operator: 'lt', value: 20 }],
        actions: [{ type: 'irrigation_command', config: { durationSeconds: 30 } }]
      });
    expect(response.status).toBe(201);
    return response.body.rule;
  }

  it('discovers and activates the sample plugin on real server startup', async () => {
    const response = await request(app)
      .get('/api/v1/plugins')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    const plugin = response.body.plugins.find((p) => p.name === PLUGIN_NAME);
    expect(plugin).toBeDefined();
    expect(plugin.status).toBe('active');
  });

  it('runs the sample plugin rule action and creates a real device command', async () => {
    await createIrrigationRule();
    await publishSoilMoisture(15);

    const commandsResponse = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const irrigationCommand = commandsResponse.body.commands.find((c) => c.type === 'irrigation');
    expect(irrigationCommand).toBeDefined();
    expect(irrigationCommand.payload).toEqual({ durationSeconds: 30 });
  });

  it('resolves the sample plugin dashboard widget with real telemetry', async () => {
    await publishSoilMoisture(42);

    const dashboardResponse = await request(app)
      .post('/api/v1/dashboards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Soil Dashboard',
        layout: [
          {
            id: 'w-soil',
            type: 'soil_moisture',
            title: 'Soil Moisture',
            position: { x: 0, y: 0, w: 2, h: 2 },
            config: { deviceId }
          }
        ]
      });
    const dashboardId = dashboardResponse.body.dashboard.id;

    const dataResponse = await request(app)
      .get(`/api/v1/dashboards/${dashboardId}/data`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dataResponse.body.widgets[0].data).toEqual({ value: 42 });
  });

  it('exposes the plugin-owned route', async () => {
    const response = await request(app).get(`/api/v1/plugin-extensions/${PLUGIN_NAME}/status`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ plugin: PLUGIN_NAME, ok: true });
  });

  it('disabling the plugin stops its route and its rule action, re-enabling restores both', async () => {
    const disableResponse = await request(app)
      .post(`/api/v1/plugins/${PLUGIN_NAME}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(disableResponse.status).toBe(200);
    expect(disableResponse.body.plugin.status).toBe('disabled');

    const routeAfterDisable = await request(app).get(`/api/v1/plugin-extensions/${PLUGIN_NAME}/status`);
    expect(routeAfterDisable.status).toBe(503);

    const rule = await createIrrigationRule();
    await publishSoilMoisture(10);

    const commandsAfterDisable = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(commandsAfterDisable.body.commands.find((c) => c.type === 'irrigation')).toBeUndefined();

    const historyResponse = await request(app)
      .get(`/api/v1/rules/${rule.id}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.body.history[0].actions_result[0]).toMatchObject({ type: 'irrigation_command', success: false });

    const enableResponse = await request(app)
      .post(`/api/v1/plugins/${PLUGIN_NAME}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(enableResponse.status).toBe(200);
    expect(enableResponse.body.plugin.status).toBe('active');

    const routeAfterEnable = await request(app).get(`/api/v1/plugin-extensions/${PLUGIN_NAME}/status`);
    expect(routeAfterEnable.status).toBe(200);

    await publishSoilMoisture(5);
    const commandsAfterEnable = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(commandsAfterEnable.body.commands.find((c) => c.type === 'irrigation')).toBeDefined();
  });

  it('rejects unauthenticated plugin listing', async () => {
    const response = await request(app).get('/api/v1/plugins');
    expect(response.status).toBe(401);
  });

  it('rejects a viewer-role token from disabling a plugin', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const response = await request(app)
      .post(`/api/v1/plugins/${PLUGIN_NAME}/disable`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(response.status).toBe(403);
  });

  it('rejects a manager-role token from disabling a plugin (admin-only permission)', async () => {
    const { token: managerToken } = await createUserWithRoles(['manager']);
    const response = await request(app)
      .post(`/api/v1/plugins/${PLUGIN_NAME}/disable`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(response.status).toBe(403);
  });
});
