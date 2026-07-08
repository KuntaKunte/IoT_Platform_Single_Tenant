import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken } from './helpers/auth.js';
import { dispatchDueCommands } from '../src/modules/commands/services/command-service.js';
import { dbClient } from '../src/shared/database.js';
import { mqttClient } from '../src/shared/mqtt.js';

describe('command platform endpoints', () => {
  let adminToken;
  let deviceId;
  let deviceApiKey;

  beforeAll(async () => {
    await mqttClient.connect();
  });

  afterAll(async () => {
    await mqttClient.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
    adminToken = await createAdminToken();

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Command Target', deviceType: 'actuator' });
    deviceId = deviceResponse.body.device.id;

    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'device-key', roles: ['device'] });
    deviceApiKey = apiKeyResponse.body.apiKey;
  });

  it('creates, dispatches, and acknowledges a command', async () => {
    const createResponse = await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId, type: 'reboot', payload: { delaySeconds: 5 } });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.command.status).toBe('pending');

    const commandId = createResponse.body.command.id;
    const { dispatched } = await dispatchDueCommands();
    expect(dispatched).toBe(1);

    const sentResponse = await request(app)
      .get(`/api/v1/commands/${commandId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sentResponse.body.command.status).toBe('sent');

    const ackResponse = await request(app)
      .post(`/api/v1/commands/${commandId}/ack`)
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, status: 'success', response: { rebooted: true } });
    expect(ackResponse.status).toBe(200);
    expect(ackResponse.body.command.status).toBe('acknowledged');
    expect(ackResponse.body.command.response).toEqual({ rebooted: true });
  });

  it('lists command history for a device', async () => {
    await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId, type: 'ping' });

    const historyResponse = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.commands.length).toBe(1);
  });

  it('rejects a command for an unknown device', async () => {
    const response = await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: 999999, type: 'reboot' });
    expect(response.status).toBe(404);
  });

  it('rejects a malformed command payload', async () => {
    const response = await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId });
    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated command creation', async () => {
    const response = await request(app).post('/api/v1/commands').send({ deviceId, type: 'reboot' });
    expect(response.status).toBe(401);
  });

  it('expires a command after exhausting retries without an ack', async () => {
    const createResponse = await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId, type: 'ping', maxAttempts: 1 });
    const commandId = createResponse.body.command.id;

    await dispatchDueCommands();

    await dbClient.query('UPDATE device_commands SET next_attempt_at = now() - interval \'1 hour\' WHERE id = $1', [
      commandId
    ]);
    await dispatchDueCommands();

    const finalResponse = await request(app)
      .get(`/api/v1/commands/${commandId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(finalResponse.body.command.status).toBe('expired');
  });
});
