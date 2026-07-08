import { createCommand } from '../../commands/services/command-service.js';

export async function executeDeviceCommand(actionConfig, context) {
  if (!actionConfig.type) {
    throw new Error('device_command action requires config.type');
  }

  const command = await createCommand(context.deviceId, actionConfig.type, actionConfig.payload || {}, {
    maxAttempts: actionConfig.maxAttempts,
    scheduledAt: actionConfig.scheduledAt
  });

  return { commandId: command.id };
}
