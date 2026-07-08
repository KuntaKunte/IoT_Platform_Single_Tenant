import Redis from 'ioredis';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger();

export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port
});

// Without a listener, Node's default EventEmitter behavior for an unhandled
// 'error' event is to throw — crashing the whole process on any Redis hiccup
// (a bad host, a restart, a network blip). Log-and-continue instead; ioredis
// already retries connections on its own.
redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});
