import { loadConfig } from '../src/shared/config.js';
import { MemoryQueue, BackgroundWorker } from '../src/shared/queue.js';
import { createMonitoringHooks } from '../src/shared/monitoring.js';

describe('infrastructure foundations', () => {
  it('loads and validates configuration', () => {
    const config = loadConfig({
      PORT: '3100',
      JWT_SECRET: 'abc123',
      JWT_REFRESH_SECRET: 'refresh123',
      POSTGRES_HOST: 'db',
      POSTGRES_PORT: '5432',
      POSTGRES_DB: 'platform',
      POSTGRES_USER: 'app',
      POSTGRES_PASSWORD: 'secret'
    });

    expect(config.port).toBe(3100);
    expect(config.postgres.host).toBe('db');
  });

  it('queues and processes background jobs in-memory', async () => {
    const queue = new MemoryQueue();
    const processed = [];
    const worker = new BackgroundWorker(queue, async (job) => {
      processed.push(job.payload);
    });

    queue.enqueue({ type: 'telemetry', payload: { sensorId: 's1' } });
    await worker.runOnce();

    expect(processed).toEqual([{ sensorId: 's1' }]);
  });

  it('collects monitoring events', () => {
    const hooks = createMonitoringHooks();
    const event = hooks.trackEvent('job.completed', { jobType: 'telemetry' });

    expect(event.name).toBe('job.completed');
    expect(event.meta).toEqual({ jobType: 'telemetry' });
  });
});
