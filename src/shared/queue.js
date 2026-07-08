export class MemoryQueue {
  constructor() {
    this.jobs = [];
  }

  enqueue(job) {
    this.jobs.push(job);
    return job;
  }

  dequeue() {
    return this.jobs.shift();
  }

  size() {
    return this.jobs.length;
  }
}

export class RedisQueue {
  constructor(redis, queueName) {
    this.redis = redis;
    this.key = `iot:queue:${queueName}`;
  }

  async enqueue(job) {
    await this.redis.rpush(this.key, JSON.stringify(job));
    return job;
  }

  async dequeue() {
    const raw = await this.redis.lpop(this.key);
    return raw ? JSON.parse(raw) : null;
  }

  async size() {
    return this.redis.llen(this.key);
  }
}

export class BackgroundWorker {
  constructor(queue, handler) {
    this.queue = queue;
    this.handler = handler;
    this.running = false;
  }

  async runOnce() {
    const job = await this.queue.dequeue();
    if (!job) {
      return null;
    }

    await this.handler(job);
    return job;
  }

  start(pollIntervalMs = 250) {
    this.running = true;
    this.loop = (async () => {
      while (this.running) {
        const job = await this.runOnce();
        if (!job) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      }
    })();
  }

  stop() {
    this.running = false;
    return this.loop;
  }
}
