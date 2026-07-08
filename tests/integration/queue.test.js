import { redisClient } from '../../src/shared/redis.js';
import { RedisQueue, BackgroundWorker } from '../../src/shared/queue.js';

describe('redis queue integration', () => {
  const queue = new RedisQueue(redisClient, 'test-queue');

  afterAll(async () => {
    await redisClient.del('iot:queue:test-queue');
  });

  it('enqueues and dequeues jobs against the real Redis container', async () => {
    await queue.enqueue({ hello: 'world' });
    expect(await queue.size()).toBe(1);

    const job = await queue.dequeue();
    expect(job).toEqual({ hello: 'world' });
    expect(await queue.size()).toBe(0);
  });

  it('drains a job via BackgroundWorker.runOnce()', async () => {
    const processed = [];
    const worker = new BackgroundWorker(queue, async (job) => {
      processed.push(job);
    });

    await queue.enqueue({ n: 1 });
    await worker.runOnce();

    expect(processed).toEqual([{ n: 1 }]);
  });
});
