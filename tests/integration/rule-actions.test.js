import http from 'http';
import { executeWebhook } from '../../src/modules/rules/actions/webhook.js';
import { executeMqttPublish } from '../../src/modules/rules/actions/mqtt-publish.js';
import { executeNotification } from '../../src/modules/rules/actions/notification.js';
import { MqttClient, mqttClient } from '../../src/shared/mqtt.js';
import { loadConfig } from '../../src/shared/config.js';

describe('rule action executors', () => {
  beforeAll(async () => {
    await mqttClient.connect();
  });

  afterAll(async () => {
    await mqttClient.disconnect();
  });


  it('executeWebhook performs a real HTTP POST', async () => {
    const receivedBodies = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        receivedBodies.push(JSON.parse(raw));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    const result = await executeWebhook(
      { url: `http://127.0.0.1:${port}/hook` },
      { deviceId: 1, payload: { temperature: 42 } }
    );

    expect(result.status).toBe(200);
    expect(receivedBodies).toEqual([{ temperature: 42 }]);

    await new Promise((resolve) => server.close(resolve));
  });

  it('executeWebhook throws when the endpoint responds with an error status', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    await expect(
      executeWebhook({ url: `http://127.0.0.1:${port}/hook` }, { deviceId: 1, payload: {} })
    ).rejects.toThrow(/status 500/);

    await new Promise((resolve) => server.close(resolve));
  });

  it('executeMqttPublish publishes a real message to the broker', async () => {
    const config = loadConfig();
    const scratchClient = new MqttClient({ ...config.mqtt, clientId: `test-rule-action-${Date.now()}` });
    await scratchClient.connect();
    await scratchClient.subscribe('devices/7/rule-alert');

    const received = new Promise((resolve) => {
      scratchClient.onMessage((topic, payload) => {
        resolve({ topic, payload: JSON.parse(payload.toString()) });
      });
    });

    await executeMqttPublish(
      { topic: 'devices/{deviceId}/rule-alert', payload: { alert: 'overheat' } },
      { deviceId: 7, payload: { temperature: 50 } }
    );

    const result = await received;
    expect(result.topic).toBe('devices/7/rule-alert');
    expect(result.payload).toEqual({ alert: 'overheat' });

    await scratchClient.disconnect();
  }, 10000);

  it('executeNotification creates a real alert and dispatches it', async () => {
    const result = await executeNotification(
      {
        title: 'Temperature high',
        message: 'Temperature high',
        channels: [{ type: 'email', recipient: 'rule-action-test@example.com' }]
      },
      { deviceId: null, payload: { temperature: 42 } }
    );
    expect(result).toEqual({ delivered: true, alertId: expect.any(Number) });
  });
});
