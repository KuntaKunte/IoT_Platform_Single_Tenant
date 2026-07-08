import { MqttClient } from '../../src/shared/mqtt.js';
import { loadConfig } from '../../src/shared/config.js';

describe('mqtt client integration', () => {
  it('connects, subscribes, and receives a published message from the real EMQX broker', async () => {
    const config = loadConfig();
    const client = new MqttClient({ ...config.mqtt, clientId: `test-client-${Date.now()}` });

    await client.connect();
    await client.subscribe('test/scratch-topic');

    const received = new Promise((resolve) => {
      client.onMessage((topic, payload) => {
        resolve({ topic, payload: payload.toString() });
      });
    });

    await client.publish('test/scratch-topic', 'hello-world');

    const result = await received;
    expect(result.topic).toBe('test/scratch-topic');
    expect(result.payload).toBe('hello-world');

    await client.disconnect();
  }, 10000);
});
