import { redisClient } from '../../shared/redis.js';
import { RedisQueue } from '../../shared/queue.js';

export const telemetryQueue = new RedisQueue(redisClient, 'telemetry');
