import express from 'express';
import {
  createDashboard,
  getDashboard,
  listDashboards,
  updateDashboard,
  deleteDashboard,
  getDashboardData,
  createTemplate,
  getTemplate,
  listTemplates,
  createDashboardFromTemplate
} from './services/dashboard-service.js';
import { authenticate, requirePermission } from '../auth/middleware.js';

const router = express.Router();
const manageDashboards = [authenticate, requirePermission('manage_dashboards')];
const readOnly = [authenticate, requirePermission('read')];

function parseIdParam(paramName, req, res) {
  const id = Number(req.params[paramName]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: `${paramName} must be a positive integer` });
    return null;
  }
  return id;
}

router.post('/', manageDashboards, async (req, res, next) => {
  try {
    const dashboard = await createDashboard(req.body);
    res.status(201).json({ dashboard });
  } catch (err) {
    next(err);
  }
});

router.get('/', readOnly, async (_req, res, next) => {
  try {
    const dashboards = await listDashboards();
    res.status(200).json({ dashboards });
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

router.post('/templates', manageDashboards, async (req, res, next) => {
  try {
    const template = await createTemplate(req.body);
    res.status(201).json({ template });
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

router.post('/templates/:templateId/instantiate', manageDashboards, async (req, res, next) => {
  try {
    const templateId = parseIdParam('templateId', req, res);
    if (templateId === null) return;

    const dashboard = await createDashboardFromTemplate(templateId, req.body);
    res.status(201).json({ dashboard });
  } catch (err) {
    next(err);
  }
});

router.get('/:dashboardId', readOnly, async (req, res, next) => {
  try {
    const dashboardId = parseIdParam('dashboardId', req, res);
    if (dashboardId === null) return;

    const dashboard = await getDashboard(dashboardId);
    res.status(200).json({ dashboard });
  } catch (err) {
    next(err);
  }
});

router.put('/:dashboardId', manageDashboards, async (req, res, next) => {
  try {
    const dashboardId = parseIdParam('dashboardId', req, res);
    if (dashboardId === null) return;

    const dashboard = await updateDashboard(dashboardId, req.body);
    res.status(200).json({ dashboard });
  } catch (err) {
    next(err);
  }
});

router.delete('/:dashboardId', manageDashboards, async (req, res, next) => {
  try {
    const dashboardId = parseIdParam('dashboardId', req, res);
    if (dashboardId === null) return;

    await deleteDashboard(dashboardId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:dashboardId/data', readOnly, async (req, res, next) => {
  try {
    const dashboardId = parseIdParam('dashboardId', req, res);
    if (dashboardId === null) return;

    const data = await getDashboardData(dashboardId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
