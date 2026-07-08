import { executeWebhook } from './webhook.js';
import { executeMqttPublish } from './mqtt-publish.js';
import { executeDeviceCommand } from './device-command.js';
import { executeNotification } from './notification.js';

const executors = {
  webhook: executeWebhook,
  mqtt_publish: executeMqttPublish,
  device_command: executeDeviceCommand,
  notification: executeNotification
};

export function registerActionExecutor(type, fn) {
  if (executors[type]) {
    throw new Error(`Rule action type "${type}" is already registered`);
  }
  executors[type] = fn;
}

export function unregisterActionExecutor(type) {
  delete executors[type];
}

export async function executeAction(action, context) {
  const executor = executors[action.type];
  if (!executor) {
    throw new Error(`Unknown action type: ${action.type}`);
  }
  return executor(action.config, context);
}
