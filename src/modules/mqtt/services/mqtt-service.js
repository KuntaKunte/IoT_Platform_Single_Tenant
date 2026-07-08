import { dbClient } from '../../../shared/database.js';
import { redisClient } from '../../../shared/redis.js';
import { loadConfig } from '../../../shared/config.js';
import { createLogger } from '../../../shared/logger.js';
import { deviceExists } from '../../devices/services/device-service.js';
import { evaluateRulesForTelemetry } from '../../rules/services/rule-service.js';
import { telemetrySchema, heartbeatSchema } from '../validation.js';
import { telemetryQueue } from '../queue.js';
import { TelemetryRepository } from '../repositories/telemetry-repository.js';
import { DeviceStatusRepository } from '../repositories/device-status-repository.js';
import { DeviceTopicRepository } from '../repositories/device-topic-repository.js';

const logger = createLogger();
const config = loadConfig();
const telemetryRepository = new TelemetryRepository(dbClient);
const deviceStatusRepository = new DeviceStatusRepository(dbClient);
const deviceTopicRepository = new DeviceTopicRepository(dbClient);

function latestValueKey(deviceId) {
  return `iot:device:${deviceId}:latest`;
}

export async function registerTopic(deviceId, topic) {
  if (!(await deviceExists(deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  await deviceTopicRepository.upsert(deviceId, topic);
  return { deviceId, topic };
}

export async function enqueueTelemetry(deviceId, topic, payload) {
  const { error } = telemetrySchema.validate({ deviceId, topic, payload });
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  if (!(await deviceExists(deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  const job = { deviceId, topic, payload, receivedAt: new Date().toISOString() };
  await telemetryQueue.enqueue(job);
  return { accepted: true, queued: true, deviceId };
}

export async function processTelemetryJob(job) {
  const { deviceId, topic, payload } = job;
  await telemetryRepository.create({ deviceId, topic, payload });

  const latest = { topic, payload, receivedAt: new Date().toISOString() };
  await redisClient.set(latestValueKey(deviceId), JSON.stringify(latest));

  await deviceStatusRepository.touch(deviceId, topic);

  try {
    await evaluateRulesForTelemetry({ deviceId, payload });
  } catch (err) {
    logger.error({ err, deviceId }, 'Rule evaluation failed for telemetry job');
  }
}

export async function recordHeartbeat(deviceId) {
  const { error } = heartbeatSchema.validate({ deviceId });
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  if (!(await deviceExists(deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  const status = await deviceStatusRepository.touch(deviceId, 'heartbeat');
  return { deviceId, online: status.online, lastSeenAt: status.last_seen_at };
}

export async function getLatestValues(deviceId) {
  const cached = await redisClient.get(latestValueKey(deviceId));
  if (cached) {
    return JSON.parse(cached);
  }

  const row = await telemetryRepository.findLatest(deviceId);
  if (!row) {
    return null;
  }

  const latest = { topic: row.topic, payload: row.payload, receivedAt: row.received_at };
  await redisClient.set(latestValueKey(deviceId), JSON.stringify(latest));
  return latest;
}

export async function getHistoricalTelemetry(deviceId, { limit = 50 } = {}) {
  const items = await telemetryRepository.findHistory(deviceId, { limit });
  return { deviceId, items };
}

export async function getDeviceStatus(deviceId) {
  const status = await deviceStatusRepository.findByDeviceId(deviceId);
  if (!status) {
    return { deviceId, online: false, lastSeenAt: null };
  }

  const isStale = status.last_seen_at && Date.now() - new Date(status.last_seen_at).getTime() > config.offlineThresholdMs;

  return {
    deviceId,
    online: status.online && !isStale,
    lastSeenAt: status.last_seen_at
  };
}
