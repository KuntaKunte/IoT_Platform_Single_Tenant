import request from 'supertest';
import app from '../src/app.js';
import { mqttClient } from '../src/shared/mqtt.js';

describe('health endpoints', () => {
  beforeAll(async () => {
    await mqttClient.connect();
  });

  afterAll(async () => {
    await mqttClient.disconnect();
  });

  it('returns service health details', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'iot-platform-single-tenant'
    });
  });

  it('reports readiness against real Postgres/Redis/MQTT/MinIO dependencies', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ready',
      dependencies: { postgres: true, redis: true, mqtt: true, minio: true }
    });
  });
});
