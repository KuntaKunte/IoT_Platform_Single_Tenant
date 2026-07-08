import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import express from 'express';
import { dbClient } from '../shared/database.js';
import { loadConfig } from '../shared/config.js';
import { createLogger } from '../shared/logger.js';
import { validateManifest } from './manifest.js';
import { PluginRepository } from './plugin-repository.js';
import { createPluginApi } from './plugin-api.js';
import { unregisterActionExecutor } from '../modules/rules/actions/index.js';
import { unregisterChannel } from '../modules/notifications/channels/index.js';
import { unregisterWidgetResolver } from '../modules/dashboards/services/dashboard-service.js';

const logger = createLogger();
const pluginRepository = new PluginRepository(dbClient);

const unregisterByKind = {
  ruleAction: unregisterActionExecutor,
  notificationChannel: unregisterChannel,
  dashboardWidget: unregisterWidgetResolver
};

// name -> { manifest, dir, module, registrations, gateStatus: { active: boolean } }
const loadedPlugins = new Map();

export async function discoverPlugins() {
  const config = loadConfig();
  const pluginsRoot = path.resolve(process.cwd(), config.pluginsDir);

  let entries;
  try {
    entries = await fs.readdir(pluginsRoot, { withFileTypes: true });
  } catch (_err) {
    return [];
  }

  const discovered = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(pluginsRoot, entry.name);
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, 'plugin.json'), 'utf8'));
      const manifest = validateManifest(raw);
      discovered.push({ manifest, dir });
    } catch (err) {
      logger.warn({ err, dir }, 'Skipping invalid plugin directory');
    }
  }
  return discovered;
}

function mountRouteGate(app, name, router) {
  const gateStatus = { active: true };
  const gate = express.Router();
  gate.use((req, res, next) => {
    if (!gateStatus.active) {
      return res.status(503).json({ error: `Plugin "${name}" is not active` });
    }
    next();
  });
  gate.use(router);
  app.use(`/api/v1/plugin-extensions/${name}`, gate);
  return gateStatus;
}

function resolvePluginEntry(dir, main) {
  const resolved = path.resolve(dir, main);
  const dirWithSep = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (!resolved.startsWith(dirWithSep)) {
    throw new Error(`Plugin manifest "main" must resolve inside the plugin's own directory`);
  }
  return resolved;
}

async function activateOne(app, dir, manifest) {
  const { name, main } = manifest;
  const moduleUrl = pathToFileURL(resolvePluginEntry(dir, main)).href;
  const imported = await import(moduleUrl);
  const plugin = imported.default;
  if (!plugin || typeof plugin.activate !== 'function') {
    throw new Error(`Plugin "${name}" does not export a default { activate } object`);
  }

  const { api, registrations } = createPluginApi(name);
  await plugin.activate(api);

  let entry = loadedPlugins.get(name);
  if (!entry) {
    const gateStatus = mountRouteGate(app, name, api.router);
    entry = { manifest, dir, module: plugin, registrations, gateStatus };
    loadedPlugins.set(name, entry);
  } else {
    entry.module = plugin;
    entry.registrations = registrations;
    entry.gateStatus.active = true;
  }

  await pluginRepository.updateStatus(name, { status: 'active', error: null });
  return entry;
}

export async function loadAndActivatePlugins(app) {
  const discovered = await discoverPlugins();
  let activated = 0;
  let failed = 0;

  for (const { manifest, dir } of discovered) {
    const row = await pluginRepository.upsert({
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      manifest
    });

    if (row.status === 'disabled') {
      continue;
    }

    try {
      await activateOne(app, dir, manifest);
      activated += 1;
    } catch (err) {
      logger.error({ err, plugin: manifest.name }, 'Plugin activation failed');
      await pluginRepository.updateStatus(manifest.name, { status: 'error', error: err.message });
      failed += 1;
    }
  }

  return { activated, failed };
}

export async function enablePlugin(app, name) {
  const row = await pluginRepository.findByName(name);
  if (!row) {
    throw Object.assign(new Error('Plugin not found'), { status: 404 });
  }

  const entry = loadedPlugins.get(name);
  if (entry) {
    entry.gateStatus.active = true;
  }

  await activateOne(app, entry?.dir || pluginDirFromManifest(row), row.manifest);
  return pluginRepository.findByName(name);
}

function pluginDirFromManifest(row) {
  const config = loadConfig();
  return path.resolve(process.cwd(), config.pluginsDir, row.name);
}

export async function disablePlugin(name) {
  const row = await pluginRepository.findByName(name);
  if (!row) {
    throw Object.assign(new Error('Plugin not found'), { status: 404 });
  }

  const entry = loadedPlugins.get(name);
  if (entry) {
    if (typeof entry.module.deactivate === 'function') {
      try {
        await entry.module.deactivate();
      } catch (err) {
        logger.error({ err, plugin: name }, 'Plugin deactivate() hook failed');
      }
    }
    for (const registration of entry.registrations) {
      unregisterByKind[registration.kind]?.(registration.type);
    }
    entry.registrations = [];
    entry.gateStatus.active = false;
  }

  return pluginRepository.updateStatus(name, { status: 'disabled', error: null });
}
