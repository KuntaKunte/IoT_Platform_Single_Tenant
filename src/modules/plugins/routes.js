import express from 'express';
import { dbClient } from '../../shared/database.js';
import { PluginRepository } from '../../plugins/plugin-repository.js';
import { enablePlugin, disablePlugin } from '../../plugins/loader.js';
import { authenticate, requirePermission } from '../auth/middleware.js';

const pluginRepository = new PluginRepository(dbClient);

const router = express.Router();
const readOnly = [authenticate, requirePermission('read')];
const managePlugins = [authenticate, requirePermission('manage_plugins')];

router.get('/', readOnly, async (_req, res, next) => {
  try {
    const plugins = await pluginRepository.findAll();
    res.status(200).json({ plugins });
  } catch (err) {
    next(err);
  }
});

router.get('/:name', readOnly, async (req, res, next) => {
  try {
    const plugin = await pluginRepository.findByName(req.params.name);
    if (!plugin) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    res.status(200).json({ plugin });
  } catch (err) {
    next(err);
  }
});

router.post('/:name/enable', managePlugins, async (req, res, next) => {
  try {
    const plugin = await enablePlugin(req.app, req.params.name);
    res.status(200).json({ plugin });
  } catch (err) {
    next(err);
  }
});

router.post('/:name/disable', managePlugins, async (req, res, next) => {
  try {
    const plugin = await disablePlugin(req.params.name);
    res.status(200).json({ plugin });
  } catch (err) {
    next(err);
  }
});

export default router;
