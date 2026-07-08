import express from 'express';
import { createLogger } from '../shared/logger.js';
import { getFieldValue } from '../shared/object-path.js';
import { authenticate, authenticateApiKey, requirePermission } from '../modules/auth/middleware.js';
import { createCommand } from '../modules/commands/services/command-service.js';
import { getLatestValues } from '../modules/mqtt/services/mqtt-service.js';
import { registerActionExecutor } from '../modules/rules/actions/index.js';
import { registerChannel } from '../modules/notifications/channels/index.js';
import { registerWidgetResolver } from '../modules/dashboards/services/dashboard-service.js';

const baseLogger = createLogger();

export function createPluginApi(pluginName) {
  const registrations = [];

  const api = {
    registerRuleAction(type, fn) {
      registerActionExecutor(type, fn);
      registrations.push({ kind: 'ruleAction', type });
    },
    registerNotificationChannel(type, fn) {
      registerChannel(type, fn);
      registrations.push({ kind: 'notificationChannel', type });
    },
    registerDashboardWidget(type, fn) {
      registerWidgetResolver(type, fn);
      registrations.push({ kind: 'dashboardWidget', type });
    },
    router: express.Router(),
    logger: baseLogger.child({ plugin: pluginName }),
    auth: { authenticate, authenticateApiKey, requirePermission },
    createDeviceCommand: createCommand,
    getLatestTelemetry: getLatestValues,
    getFieldValue
  };

  return { api, registrations };
}
