import request from 'supertest';
import app from '../../src/app.js';
import { resetDatabase } from '../helpers/reset-db.js';
import { createAdminToken } from '../helpers/auth.js';
import { dispatchDueCommands } from '../../src/modules/commands/services/command-service.js';
import { startMqttSubscriber } from '../../src/modules/mqtt/subscriber.js';
import { MqttClient, mqttClient } from '../../src/shared/mqtt.js';
import { loadConfig } from '../../src/shared/config.js';

describe('command MQTT round trip', () => {
  afterAll(async () => {
    await mqttClient.disconnect();
  });


  it('publishes a dispatched command over MQTT and processes a real ack published back', async () => {
    await resetDatabase();
    // Route-level tests hit app.js directly, which never runs server.js's subscriber
    // bootstrap — start it here so the real ack-handling path in subscriber.js is exercised.
    await startMqttSubscriber();
    const adminToken = await createAdminToken();

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'MQTT Command Device', deviceType: 'actuator' });
    const deviceId = deviceResponse.body.device.id;

    const config = loadConfig();
    const scratchClient = new MqttClient({ ...config.mqtt, clientId: `test-command-client-${Date.now()}` });
    await scratchClient.connect();
    await scratchClient.subscribe(`devices/${deviceId}/commands`);

    const publishedCommand = new Promise((resolve) => {
      scratchClient.onMessage((topic, payload) => {
        resolve({ topic, payload: JSON.parse(payload.toString()) });
      });
    });

    const createResponse = await request(app)
      .post('/api/v1/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId, type: 'reboot', payload: { delaySeconds: 1 } });
    const commandId = createResponse.body.command.id;

    await dispatchDueCommands();

    const received = await publishedCommand;
    expect(received.topic).toBe(`devices/${deviceId}/commands`);
    expect(received.payload).toMatchObject({ commandId: String(commandId), type: 'reboot' });

    await scratchClient.publish(
      `devices/${deviceId}/commands/ack`,
      JSON.stringify({ commandId, status: 'success', response: { rebooted: true } })
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    const finalResponse = await request(app)
      .get(`/api/v1/commands/${commandId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(finalResponse.body.command.status).toBe('acknowledged');

    await scratchClient.disconnect();
  }, 15000);
});
