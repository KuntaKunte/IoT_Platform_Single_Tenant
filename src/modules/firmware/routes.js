import express from 'express';
import multer from 'multer';
import { loadConfig } from '../../shared/config.js';
import { uploadFirmware, listFirmware, getFirmware, downloadFirmwareStream } from './services/firmware-service.js';
import { authenticate, authenticateApiKey, requirePermission } from '../auth/middleware.js';
import './hooks.js';

const config = loadConfig();
const router = express.Router();
const manageDevices = [authenticate, requirePermission('manage_devices')];
const readOnly = [authenticate, requirePermission('read')];
const deviceDownload = [authenticateApiKey, requirePermission('ack_commands')];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.firmwareMaxSizeBytes } });

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

router.post('/', manageDevices, uploadOrBadRequest(upload.single('file')), async (req, res, next) => {
  try {
    const firmware = await uploadFirmware(req.body, req.file?.buffer, req.file?.mimetype);
    res.status(201).json({ firmware });
  } catch (err) {
    next(err);
  }
});

router.get('/', readOnly, async (req, res, next) => {
  try {
    const firmware = await listFirmware({ deviceType: req.query.deviceType });
    res.status(200).json({ firmware });
  } catch (err) {
    next(err);
  }
});

router.get('/:firmwareId', readOnly, async (req, res, next) => {
  try {
    const firmwareId = parseIdParam('firmwareId', req, res);
    if (firmwareId === null) return;

    const firmware = await getFirmware(firmwareId);
    res.status(200).json({ firmware });
  } catch (err) {
    next(err);
  }
});

router.get('/:firmwareId/download', deviceDownload, async (req, res, next) => {
  try {
    const firmwareId = parseIdParam('firmwareId', req, res);
    if (firmwareId === null) return;

    const { stream, firmware } = await downloadFirmwareStream(firmwareId);
    res.setHeader('Content-Type', firmware.content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${firmware.version}.bin"`);
    res.setHeader('X-Firmware-Checksum', firmware.checksum);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
