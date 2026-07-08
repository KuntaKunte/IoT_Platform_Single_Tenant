import express from 'express';
import {
  registerTopic,
  enqueueTelemetry,
  getLatestValues,
  getHistoricalTelemetry,
  recordHeartbeat,
  getDeviceStatus
} from './services/mqtt-service.js';
import { authenticate, authenticateApiKey, requirePermission } from '../auth/middleware.js';
import { topicSchema } from './validation.js';

const router = express.Router();
const ingest = [authenticateApiKey, requirePermission('ingest_telemetry')];
const manageDevices = [authenticate, requirePermission('manage_devices')];
const readOnly = [authenticate, requirePermission('read')];

function parseDeviceIdParam(req, res) {
  const deviceId = Number(req.params.deviceId);
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    res.status(400).json({ error: 'deviceId must be a positive integer' });
    return null;
  }
  return deviceId;
}

router.post('/telemetry', ingest, async (req, res, next) => {
  try {
    const result = await enqueueTelemetry(req.body.deviceId, req.body.topic, req.body.payload);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/topics', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = topicSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await registerTopic(value.deviceId, value.topic);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/devices/:deviceId/latest', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseDeviceIdParam(req, res);
    if (deviceId === null) return;

    res.status(200).json({ deviceId, value: await getLatestValues(deviceId) });
  } catch (err) {
    next(err);
  }
});

router.post('/heartbeat', ingest, async (req, res, next) => {
  try {
    const result = await recordHeartbeat(req.body.deviceId);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/devices/:deviceId/status', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseDeviceIdParam(req, res);
    if (deviceId === null) return;

    res.status(200).json(await getDeviceStatus(deviceId));
  } catch (err) {
    next(err);
  }
});

router.get('/devices/:deviceId/history', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseDeviceIdParam(req, res);
    if (deviceId === null) return;

    res.status(200).json(await getHistoricalTelemetry(deviceId));
  } catch (err) {
    next(err);
  }
});

export default router;
