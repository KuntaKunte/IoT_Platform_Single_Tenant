/**
 * @typedef {object} PluginApi
 * @property {(type: string, fn: (config: object, context: object) => Promise<any>) => void} registerRuleAction
 * @property {(type: string, fn: (recipient: string, message: object) => Promise<any>) => void} registerNotificationChannel
 * @property {(type: string, fn: (widget: object) => Promise<any>) => void} registerDashboardWidget
 * @property {import('express').Router} router
 * @property {import('pino').Logger} logger
 * @property {{authenticate: Function, authenticateApiKey: Function, requirePermission: (permission: string) => Function}} auth
 * @property {(deviceId: number, type: string, payload?: object, opts?: object) => Promise<any>} createDeviceCommand
 * @property {(deviceId: number) => Promise<any>} getLatestTelemetry
 * @property {(payload: object, path: string) => any} getFieldValue
 */

/**
 * @typedef {object} Plugin
 * @property {(api: PluginApi) => void} activate
 * @property {() => void} [deactivate]
 */

/**
 * Identity helper for authoring a plugin — gives editors autocomplete via the
 * JSDoc typedefs above without requiring TypeScript in this project.
 * @param {Plugin} config
 * @returns {Plugin}
 */
export function definePlugin(config) {
  return config;
}

export { getFieldValue } from '../shared/object-path.js';
