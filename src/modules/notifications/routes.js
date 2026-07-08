import express from 'express';
import { createAlert, getAlert, listAlerts, acknowledgeAlert, getAlertDeliveries } from './services/alert-service.js';
import { createTemplate, getTemplate, listTemplates } from './services/template-service.js';
import { authenticate, requirePermission } from '../auth/middleware.js';

const router = express.Router();
const manageNotifications = [authenticate, requirePermission('manage_notifications')];
const readOnly = [authenticate, requirePermission('read')];

function parseIdParam(paramName, req, res) {
  const id = Number(req.params[paramName]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: `${paramName} must be a positive integer` });
    return null;
  }
  return id;
}

router.post('/alerts', manageNotifications, async (req, res, next) => {
  try {
    const alert = await createAlert(req.body);
    res.status(201).json({ alert });
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', readOnly, async (_req, res, next) => {
  try {
    const alerts = await listAlerts();
    res.status(200).json({ alerts });
  } catch (err) {
    next(err);
  }
});

router.get('/alerts/:alertId', readOnly, async (req, res, next) => {
  try {
    const alertId = parseIdParam('alertId', req, res);
    if (alertId === null) return;

    const alert = await getAlert(alertId);
    res.status(200).json({ alert });
  } catch (err) {
    next(err);
  }
});

router.post('/alerts/:alertId/ack', manageNotifications, async (req, res, next) => {
  try {
    const alertId = parseIdParam('alertId', req, res);
    if (alertId === null) return;

    const alert = await acknowledgeAlert(alertId);
    res.status(200).json({ alert });
  } catch (err) {
    next(err);
  }
});

router.get('/alerts/:alertId/deliveries', readOnly, async (req, res, next) => {
  try {
    const alertId = parseIdParam('alertId', req, res);
    if (alertId === null) return;

    const deliveries = await getAlertDeliveries(alertId);
    res.status(200).json({ deliveries });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', manageNotifications, async (req, res, next) => {
  try {
    const template = await createTemplate(req.body);
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

router.get('/templates', readOnly, async (_req, res, next) => {
  try {
    const templates = await listTemplates();
    res.status(200).json({ templates });
  } catch (err) {
    next(err);
  }
});

router.get('/templates/:templateId', readOnly, async (req, res, next) => {
  try {
    const templateId = parseIdParam('templateId', req, res);
    if (templateId === null) return;

    const template = await getTemplate(templateId);
    res.status(200).json({ template });
  } catch (err) {
    next(err);
  }
});

export default router;
