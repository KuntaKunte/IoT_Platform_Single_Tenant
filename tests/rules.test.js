import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';
import { createTelemetryWorker } from '../src/modules/mqtt/worker.js';
import { redisClient } from '../src/shared/redis.js';

describe('rules engine endpoints', () => {
  let adminToken;
  let deviceId;
  let deviceApiKey;
  let worker;

  beforeEach(async () => {
    await resetDatabase();
    await redisClient.del('iot:queue:telemetry');
    adminToken = await createAdminToken();
    worker = createTelemetryWorker();

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Rule Test Sensor', deviceType: 'sensor' });
    deviceId = deviceResponse.body.device.id;

    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'rule-device-key', roles: ['device'] });
    deviceApiKey = apiKeyResponse.body.apiKey;
  });

  async function createRule(overrides = {}) {
    const response = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'High temperature alert',
        deviceId,
        conditions: [{ field: 'temperature', operator: 'gt', value: 30 }],
        actions: [{ type: 'device_command', config: { type: 'alert', payload: { reason: 'overheat' } } }],
        ...overrides
      });
    return response;
  }

  async function ingestTelemetry(payload) {
    await request(app)
      .post('/api/v1/mqtt/telemetry')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, topic: `devices/${deviceId}/telemetry`, payload });
    await worker.runOnce();
  }

  it('matches telemetry above threshold, creates a device command, and records history', async () => {
    const createResponse = await createRule();
    expect(createResponse.status).toBe(201);
    const ruleId = createResponse.body.rule.id;

    await ingestTelemetry({ temperature: 35 });

    const commandsResponse = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(commandsResponse.body.commands.length).toBe(1);
    expect(commandsResponse.body.commands[0].type).toBe('alert');

    const historyResponse = await request(app)
      .get(`/api/v1/rules/${ruleId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.body.history.length).toBe(1);
    expect(historyResponse.body.history[0].actions_result[0]).toMatchObject({ type: 'device_command', success: true });
  });

  it('does not match telemetry below threshold', async () => {
    const createResponse = await createRule();
    const ruleId = createResponse.body.rule.id;

    await ingestTelemetry({ temperature: 10 });

    const commandsResponse = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(commandsResponse.body.commands.length).toBe(0);

    const historyResponse = await request(app)
      .get(`/api/v1/rules/${ruleId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.body.history.length).toBe(0);
  });

  it('increments version and preserves the prior version on update', async () => {
    const createResponse = await createRule();
    const ruleId = createResponse.body.rule.id;

    const updateResponse = await request(app)
      .put(`/api/v1/rules/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'High temperature alert',
        deviceId,
        conditions: [{ field: 'temperature', operator: 'gt', value: 40 }],
        actions: [{ type: 'device_command', config: { type: 'alert', payload: {} } }]
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.rule.version).toBe(2);

    const versionsResponse = await request(app)
      .get(`/api/v1/rules/${ruleId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(versionsResponse.body.versions.length).toBe(1);
    expect(versionsResponse.body.versions[0]).toMatchObject({ version: 1 });
    expect(versionsResponse.body.versions[0].conditions[0].value).toBe(30);
  });

  it('dry-run tests a rule without side effects', async () => {
    const createResponse = await createRule();
    const ruleId = createResponse.body.rule.id;

    const matchResponse = await request(app)
      .post(`/api/v1/rules/${ruleId}/test`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payload: { temperature: 45 } });
    expect(matchResponse.body.matched).toBe(true);
    expect(matchResponse.body.actionsThatWouldRun.length).toBe(1);

    const noMatchResponse = await request(app)
      .post(`/api/v1/rules/${ruleId}/test`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payload: { temperature: 10 } });
    expect(noMatchResponse.body.matched).toBe(false);

    const historyResponse = await request(app)
      .get(`/api/v1/rules/${ruleId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.body.history.length).toBe(0);

    const commandsResponse = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(commandsResponse.body.commands.length).toBe(0);
  });

  it('rejects a rule for an unknown device', async () => {
    const response = await createRule({ deviceId: 999999 });
    expect(response.status).toBe(404);
  });

  it('rejects a malformed rule payload', async () => {
    const response = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Missing conditions', deviceId });
    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated rule creation', async () => {
    const response = await request(app).post('/api/v1/rules').send({ name: 'x' });
    expect(response.status).toBe(401);
  });

  it('rejects a viewer-role token from managing rules', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const response = await request(app)
      .post('/api/v1/rules')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'Should fail',
        deviceId,
        conditions: [{ field: 'temperature', operator: 'gt', value: 30 }],
        actions: [{ type: 'notification', config: { message: 'x' } }]
      });
    expect(response.status).toBe(403);
  });
});
