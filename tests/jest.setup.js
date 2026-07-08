import { dbClient } from '../src/shared/database.js';
import { redisClient } from '../src/shared/redis.js';

afterAll(async () => {
  await dbClient.disconnect();
  redisClient.disconnect();
});
