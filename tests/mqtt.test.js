import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken } from './helpers/auth.js';
import { createTelemetryWorker } from '../src/modules/mqtt/worker.js';
import { redisClient } from '../src/shared/redis.js';

describe('mqtt platform endpoints', () => {
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
      .send({ assetId: null, name: 'Telemetry Gateway', deviceType: 'gateway' });
    deviceId = deviceResponse.body.device.id;

    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'device-key', roles: ['device'] });
    deviceApiKey = apiKeyResponse.body.apiKey;
  });

  it('accepts telemetry payloads and processes them into latest values and history', async () => {
    const response = await request(app)
      .post('/api/v1/mqtt/telemetry')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, topic: `devices/${deviceId}/telemetry`, payload: { temperature: 22.5 } });

    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(true);

    await worker.runOnce();

    const latestResponse = await request(app)
      .get(`/api/v1/mqtt/devices/${deviceId}/latest`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(latestResponse.status).toBe(200);
    expect(latestResponse.body.value.payload).toEqual({ temperature: 22.5 });

    const historyResponse = await request(app)
      .get(`/api/v1/mqtt/devices/${deviceId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.items.length).toBe(1);
  });

  it('tracks heartbeat and online status', async () => {
    const heartbeatResponse = await request(app)
      .post('/api/v1/mqtt/heartbeat')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId });
    expect(heartbeatResponse.status).toBe(202);

    const statusResponse = await request(app)
      .get(`/api/v1/mqtt/devices/${deviceId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.online).toBe(true);
  });

  it('rejects telemetry for an unknown device', async () => {
    const response = await request(app)
      .post('/api/v1/mqtt/telemetry')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId: 999999, topic: 'devices/999999/telemetry', payload: { temperature: 1 } });
    expect(response.status).toBe(404);
  });

  it('rejects a malformed telemetry payload', async () => {
    const response = await request(app)
      .post('/api/v1/mqtt/telemetry')
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, topic: `devices/${deviceId}/telemetry` });
    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated telemetry ingestion', async () => {
    const response = await request(app)
      .post('/api/v1/mqtt/telemetry')
      .send({ deviceId, topic: `devices/${deviceId}/telemetry`, payload: { temperature: 1 } });
    expect(response.status).toBe(401);
  });
});
