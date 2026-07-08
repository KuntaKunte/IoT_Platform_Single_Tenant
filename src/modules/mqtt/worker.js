import { BackgroundWorker } from '../../shared/queue.js';
import { telemetryQueue } from './queue.js';
import { processTelemetryJob } from './services/mqtt-service.js';

export function createTelemetryWorker() {
  return new BackgroundWorker(telemetryQueue, processTelemetryJob);
}
