import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import { createLogger } from './shared/logger.js';
import { loadConfig } from './shared/config.js';
import { createMonitoringHooks } from './shared/monitoring.js';
import { dbClient } from './shared/database.js';
import { redisClient } from './shared/redis.js';
import { mqttClient } from './shared/mqtt.js';
import { storageClient } from './shared/storage.js';
import { register, metricsMiddleware } from './shared/metrics.js';
import authRoutes from './modules/auth/routes.js';
import deviceRoutes from './modules/devices/routes.js';
import mqttRoutes from './modules/mqtt/routes.js';
import commandRoutes from './modules/commands/routes.js';
import ruleRoutes from './modules/rules/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import dashboardRoutes from './modules/dashboards/routes.js';
import reportRoutes from './modules/reports/routes.js';
import firmwareRoutes from './modules/firmware/routes.js';
import deviceFirmwareRoutes from './modules/firmware/device-routes.js';
import pluginRoutes from './modules/plugins/routes.js';

dotenv.config();

const app = express();
const logger = createLogger();
const config = loadConfig();
const monitoring = createMonitoringHooks();

// Prometheus scrapes and container healthchecks hit these every few seconds —
// they shouldn't burn rate-limit budget or spam request logs.
const NOISY_PATHS = new Set(['/health', '/health/ready', '/metrics']);

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => NOISY_PATHS.has(req.url) },
    // Bearer JWTs and API keys must never land in logs verbatim.
    redact: {
      paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
      censor: '[redacted]'
    }
  })
);
app.use(metricsMiddleware);
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => NOISY_PATHS.has(req.path)
  })
);

// Liveness: is the process alive and able to respond at all. No dependency I/O —
// safe for a tight probe interval. See /health/ready for real dependency checks.
app.get('/health', (_req, res) => {
  monitoring.trackEvent('health.check', { service: 'api' });
  res.status(200).json({
    status: 'ok',
    service: 'iot-platform-single-tenant',
    timestamp: new Date().toISOString(),
    config: {
      postgres: config.postgres.host,
      redis: config.redis.host,
      mqtt: config.mqtt.host
    }
  });
});

// Bounds each dependency check so a slow/hung client (e.g. ioredis queueing
// commands while it retries a dead connection instead of failing fast) can't make
// this endpoint itself hang — a readiness probe needs to respond quickly either way.
const READY_CHECK_TIMEOUT_MS = 3000;
function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timed out')), READY_CHECK_TIMEOUT_MS))
  ]);
}

// Readiness: are our real dependencies reachable. Fit for a readiness probe /
// load-balancer target check, not a tight liveness interval.
app.get('/health/ready', async (_req, res) => {
  const checks = await Promise.allSettled([
    withTimeout(dbClient.query('SELECT 1').then(() => true)),
    withTimeout(redisClient.ping().then((reply) => reply === 'PONG')),
    withTimeout(Promise.resolve(Boolean(mqttClient.client?.connected))),
    withTimeout(storageClient.bucketExists())
  ]);

  const [postgres, redis, mqtt, minio] = checks.map((result) => result.status === 'fulfilled' && result.value === true);
  const dependencies = { postgres, redis, mqtt, minio };
  const healthy = Object.values(dependencies).every(Boolean);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ready' : 'not_ready',
    dependencies,
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/v1/infrastructure', (_req, res) => {
  res.status(200).json({
    config: {
      postgres: config.postgres,
      redis: config.redis,
      mqtt: config.mqtt,
      minio: config.minio
    },
    monitoring: monitoring.events.slice(-5)
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/mqtt', mqttRoutes);
app.use('/api/v1/commands', commandRoutes);
app.use('/api/v1/rules', ruleRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/dashboards', dashboardRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/firmware', firmwareRoutes);
app.use('/api/v1/devices', deviceFirmwareRoutes);
app.use('/api/v1/plugins', pluginRoutes);

app.use((err, _req, res, _next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

export default app;
