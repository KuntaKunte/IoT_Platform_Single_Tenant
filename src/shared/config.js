import dotenv from 'dotenv';

dotenv.config();

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: toNumber(env.PORT, 3000),
    jwtSecret: env.JWT_SECRET || 'dev-secret',
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    postgres: {
      host: env.POSTGRES_HOST || 'localhost',
      port: toNumber(env.POSTGRES_PORT, 5432),
      database: env.POSTGRES_DB || 'iot_platform',
      user: env.POSTGRES_USER || 'iot_user',
      password: env.POSTGRES_PASSWORD || 'change-me',
      poolMax: toNumber(env.PG_POOL_MAX, 20),
      poolIdleTimeoutMs: toNumber(env.PG_POOL_IDLE_TIMEOUT_MS, 30000),
      poolConnectionTimeoutMs: toNumber(env.PG_POOL_CONNECTION_TIMEOUT_MS, 5000),
      statementTimeoutMs: toNumber(env.PG_STATEMENT_TIMEOUT_MS, 30000)
    },
    redis: {
      host: env.REDIS_HOST || 'localhost',
      port: toNumber(env.REDIS_PORT, 6379)
    },
    mqtt: {
      host: env.MQTT_HOST || 'localhost',
      port: toNumber(env.MQTT_PORT, 1883),
      username: env.MQTT_USERNAME || undefined,
      password: env.MQTT_PASSWORD || undefined,
      clientId: env.MQTT_CLIENT_ID || 'iot-platform-backend'
    },
    minio: {
      endpoint: env.MINIO_ENDPOINT || 'localhost',
      port: toNumber(env.MINIO_PORT, 9000),
      accessKey: env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: env.MINIO_SECRET_KEY || 'minioadmin',
      bucket: env.MINIO_BUCKET || 'iot-platform',
      useSSL: env.MINIO_USE_SSL === 'true'
    },
    smtp: {
      host: env.SMTP_HOST || 'localhost',
      port: toNumber(env.SMTP_PORT, 1025),
      user: env.SMTP_USER || undefined,
      password: env.SMTP_PASSWORD || undefined,
      from: env.SMTP_FROM || 'alerts@iot-platform.local'
    },
    offlineThresholdMs: toNumber(env.OFFLINE_THRESHOLD_MS, 90000),
    offlineCheckIntervalMs: toNumber(env.OFFLINE_CHECK_INTERVAL_MS, 30000),
    commandDispatchIntervalMs: toNumber(env.COMMAND_DISPATCH_INTERVAL_MS, 5000),
    commandAckTimeoutMs: toNumber(env.COMMAND_ACK_TIMEOUT_MS, 30000),
    commandDefaultMaxAttempts: toNumber(env.COMMAND_DEFAULT_MAX_ATTEMPTS, 3),
    ruleWebhookTimeoutMs: toNumber(env.RULE_WEBHOOK_TIMEOUT_MS, 5000),
    webhookNotificationTimeoutMs: toNumber(env.WEBHOOK_NOTIFICATION_TIMEOUT_MS, 5000),
    notificationDispatchIntervalMs: toNumber(env.NOTIFICATION_DISPATCH_INTERVAL_MS, 5000),
    notificationDefaultMaxAttempts: toNumber(env.NOTIFICATION_DEFAULT_MAX_ATTEMPTS, 3),
    notificationRetryBackoffMs: toNumber(env.NOTIFICATION_RETRY_BACKOFF_MS, 30000),
    reportDispatchIntervalMs: toNumber(env.REPORT_DISPATCH_INTERVAL_MS, 60000),
    firmwareMaxSizeBytes: toNumber(env.FIRMWARE_MAX_SIZE_BYTES, 104857600),
    logMaxSizeBytes: toNumber(env.LOG_MAX_SIZE_BYTES, 20971520),
    pluginsDir: env.PLUGINS_DIR || 'plugins',
    allowPrivateWebhookTargets: env.ALLOW_PRIVATE_WEBHOOK_TARGETS === 'true',
    rateLimit: {
      windowMs: toNumber(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      max: toNumber(env.RATE_LIMIT_MAX, 2000),
      authWindowMs: toNumber(env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      authMax: toNumber(env.AUTH_RATE_LIMIT_MAX, 10)
    }
  };
}
