import { getDevice } from '../../devices/services/device-service.js';
import { createCommand, getLatestCommand } from '../../commands/services/command-service.js';

export async function requestDiagnostics(deviceId) {
  await getDevice(deviceId);
  return createCommand(deviceId, 'diagnostics', {});
}

export async function getLatestDiagnostics(deviceId) {
  await getDevice(deviceId);
  const command = await getLatestCommand(deviceId, 'diagnostics', 'acknowledged');
  if (!command) {
    return null;
  }
  return { commandId: command.id, response: command.response, acknowledgedAt: command.acknowledged_at };
}
