import express from 'express';
import {
  createSite,
  createAsset,
  createDevice,
  createSensor,
  createDeviceType,
  createDeviceTemplate,
  searchDevices,
  provisionDevice,
  getDeviceRegistry,
  getDevice
} from './services/device-service.js';
import { authenticate, requirePermission } from '../auth/middleware.js';
import {
  siteSchema,
  assetSchema,
  deviceSchema,
  sensorSchema,
  deviceTypeSchema,
  deviceTemplateSchema,
  provisionSchema
} from './validation.js';

const router = express.Router();
const manageDevices = [authenticate, requirePermission('manage_devices')];
const readOnly = [authenticate, requirePermission('read')];

router.post('/sites', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = siteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const site = await createSite(value.name, value.location);
    res.status(201).json({ site });
  } catch (err) {
    next(err);
  }
});

router.post('/assets', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = assetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const asset = await createAsset(value.siteId, value.name);
    res.status(201).json({ asset });
  } catch (err) {
    next(err);
  }
});

router.post('/', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = deviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const device = await createDevice(value.assetId, value.name, value.deviceType, value.metadata);
    res.status(201).json({ device });
  } catch (err) {
    next(err);
  }
});

router.post('/sensors', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = sensorSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const sensor = await createSensor(value.deviceId, value.name, value.metric);
    res.status(201).json({ sensor });
  } catch (err) {
    next(err);
  }
});

router.post('/types', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = deviceTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const deviceType = await createDeviceType(value.name, value.description);
    res.status(201).json({ deviceType });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = deviceTemplateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const template = await createDeviceTemplate(value.name, value.defaults);
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

router.get('/search', readOnly, async (req, res, next) => {
  try {
    const items = await searchDevices(req.query.q || '');
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/provision', manageDevices, async (req, res, next) => {
  try {
    const { value, error } = provisionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const device = await provisionDevice(value.templateId, value.name);
    res.status(201).json({ device });
  } catch (err) {
    next(err);
  }
});

router.get('/registry', readOnly, async (_req, res, next) => {
  try {
    const registry = await getDeviceRegistry();
    res.status(200).json(registry);
  } catch (err) {
    next(err);
  }
});

router.get('/:deviceId', readOnly, async (req, res, next) => {
  try {
    const deviceId = Number(req.params.deviceId);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'deviceId must be a positive integer' });
    }

    const device = await getDevice(deviceId);
    res.status(200).json({ device });
  } catch (err) {
    next(err);
  }
});

export default router;
