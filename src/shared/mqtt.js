import mqtt from 'mqtt';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger();

export class MqttClient {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `mqtt://${this.config.host}:${this.config.port}`;
      this.client = mqtt.connect(url, {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password
      });

      this.client.once('connect', () => resolve({ connected: true }));
      this.client.once('error', (err) => reject(err));

      // The `once` listener above only covers the initial connection attempt.
      // Without a persistent listener, an unhandled 'error' event on a later
      // reconnect failure would crash the process the same way an unlistened
      // Redis error does — see shared/redis.js. mqtt.js retries on its own.
      this.client.on('error', (err) => {
        logger.error({ err }, 'MQTT client error');
      });
    });
  }

  subscribe(topics) {
    return new Promise((resolve, reject) => {
      this.client.subscribe(topics, (err) => {
        if (err) return reject(err);
        resolve({ subscribed: topics });
      });
    });
  }

  onMessage(handler) {
    this.client.on('message', (topic, payload) => handler(topic, payload));
  }

  publish(topic, payload) {
    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, (err) => {
        if (err) return reject(err);
        resolve({ topic, payload });
      });
    });
  }

  disconnect() {
    return new Promise((resolve) => {
      if (!this.client) return resolve();
      this.client.end(false, {}, () => resolve());
    });
  }
}

export const mqttClient = new MqttClient(loadConfig().mqtt);
