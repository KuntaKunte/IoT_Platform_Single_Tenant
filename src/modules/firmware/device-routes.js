import express from 'express';
import multer from 'multer';
import { loadConfig } from '../../shared/config.js';
import { createCommand } from '../commands/services/command-service.js';
import {
  deployFirmware,
  rollbackFirmware,
  getDeployments,
  getCurrentFirmware
} from './services/firmware-service.js';
import { setDesiredConfig, getConfiguration } from './services/config-service.js';
import { requestDiagnostics, getLatestDiagnostics } from './services/diagnostics-service.js';
import { requestLogCollection, recordUpload, getCollections, downloadLogStream } from './services/log-service.js';
import { authenticate, authenticateApiKey, requirePermission } from '../auth/middleware.js';

const config = loadConfig();
const router = express.Router();
const sendCommands = [authenticate, requirePermission('send_commands')];
const readOnly = [authenticate, requirePermission('read')];
const deviceUpload = [authenticateApiKey, requirePermission('ack_commands')];

const logUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.logMaxSizeBytes } });

function uploadOrBadRequest(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
}

function parseIdParam(paramName, req, res) {
  const id = Number(req.params[paramName]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: `${paramName} must be a positive integer` });
    return null;
  }
  return id;
}

router.post('/:deviceId/firmware/deploy', sendCommands, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const deployment = await deployFirmware(deviceId, req.body);
    res.status(201).json({ deployment });
  } catch (err) {
    next(err);
  }
});

router.post('/:deviceId/firmware/rollback', sendCommands, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const deployment = await rollbackFirmware(deviceId);
    res.status(201).json({ deployment });
  } catch (err) {
    next(err);
  }
});

router.get('/:deviceId/firmware/deployments', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const deployments = await getDeployments(deviceId);
    res.status(200).json({ deployments });
  } catch (err) {
    next(err);
  }
});

router.get('/:deviceId/firmware/current', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const current = await getCurrentFirmware(deviceId);
    res.status(200).json({ current });
  } catch (err) {
    next(err);
  }
});

router.put('/:deviceId/configuration', sendCommands, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const configuration = await setDesiredConfig(deviceId, req.body);
    res.status(200).json({ configuration });
  } catch (err) {
    next(err);
  }
});

router.get('/:deviceId/configuration', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const configuration = await getConfiguration(deviceId);
    res.status(200).json({ configuration });
  } catch (err) {
    next(err);
  }
});

router.post('/:deviceId/diagnostics', sendCommands, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const command = await requestDiagnostics(deviceId);
    res.status(201).json({ command });
  } catch (err) {
    next(err);
  }
});

router.get('/:deviceId/diagnostics', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const diagnostics = await getLatestDiagnostics(deviceId);
    res.status(200).json({ diagnostics });
  } catch (err) {
    next(err);
  }
});

router.post('/:deviceId/logs', sendCommands, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const collection = await requestLogCollection(deviceId);
    res.status(201).json({ collection });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:deviceId/logs/:collectionId/upload',
  deviceUpload,
  uploadOrBadRequest(logUpload.single('file')),
  async (req, res, next) => {
    try {
      const deviceId = parseIdParam('deviceId', req, res);
      if (deviceId === null) return;
      const collectionId = parseIdParam('collectionId', req, res);
      if (collectionId === null) return;

      const collection = await recordUpload(deviceId, collectionId, req.file?.buffer, req.file?.mimetype);
      res.status(200).json({ collection });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/:deviceId/logs', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const collections = await getCollections(deviceId);
    res.status(200).json({ collections });
  } catch (err) {
    next(err);
  }
});

router.get('/:deviceId/logs/:collectionId/download', readOnly, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;
    const collectionId = parseIdParam('collectionId', req, res);
    if (collectionId === null) return;

    const { stream, collection } = await downloadLogStream(deviceId, collectionId);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="device-${collection.device_id}-log-${collection.id}.txt"`);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

router.post('/:deviceId/reboot', sendCommands, async (req, res, next) => {
  try {
    const deviceId = parseIdParam('deviceId', req, res);
    if (deviceId === null) return;

    const command = await createCommand(deviceId, 'reboot', {});
    res.status(201).json({ command });
  } catch (err) {
    next(err);
  }
});

export default router;
