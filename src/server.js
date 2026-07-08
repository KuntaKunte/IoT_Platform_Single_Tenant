import dotenv from 'dotenv';

dotenv.config();

import app from './app.js';
import { createLogger } from './shared/logger.js';
import { loadConfig } from './shared/config.js';
import { dbClient } from './shared/database.js';
import { mqttClient } from './shared/mqtt.js';
import { storageClient } from './shared/storage.js';
import { applyPendingMigrations } from './migrations/run-migrations.js';
import { startMqttSubscriber } from './modules/mqtt/subscriber.js';
import { createTelemetryWorker } from './modules/mqtt/worker.js';
import { startOfflineDetector } from './modules/mqtt/offline-detector.js';
import { startCommandDispatcher } from './modules/commands/dispatcher.js';
import { startNotificationDispatcher } from './modules/notifications/dispatcher.js';
import { startReportDispatcher } from './modules/reports/dispatcher.js';
import { loadAndActivatePlugins } from './plugins/loader.js';

const logger = createLogger();

async function start() {
  const config = loadConfig();

  await dbClient.connect();
  const appliedCount = await applyPendingMigrations(dbClient);
  logger.info(`Applied ${appliedCount} migration(s)`);

  await storageClient.ensureBucket();

  const { activated, failed } = await loadAndActivatePlugins(app);
  logger.info(`Activated ${activated} plugin(s), ${failed} failed`);

  const worker = createTelemetryWorker();
  worker.start();

  await startMqttSubscriber();

  const stopOfflineDetector = startOfflineDetector({
    thresholdMs: config.offlineThresholdMs,
    intervalMs: config.offlineCheckIntervalMs
  });

  const stopCommandDispatcher = startCommandDispatcher({
    intervalMs: config.commandDispatchIntervalMs
  });

  const stopNotificationDispatcher = startNotificationDispatcher({
    intervalMs: config.notificationDispatchIntervalMs
  });

  const stopReportDispatcher = startReportDispatcher({
    intervalMs: config.reportDispatchIntervalMs
  });

  const server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully');
    server.close();
    worker.stop();
    stopOfflineDetector();
    stopCommandDispatcher();
    stopNotificationDispatcher();
    stopReportDispatcher();
    await mqttClient.disconnect();
    await dbClient.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
