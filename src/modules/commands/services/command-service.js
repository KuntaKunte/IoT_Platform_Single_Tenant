import { dbClient } from '../../../shared/database.js';
import { mqttClient } from '../../../shared/mqtt.js';
import { loadConfig } from '../../../shared/config.js';
import { createLogger } from '../../../shared/logger.js';
import { deviceExists } from '../../devices/services/device-service.js';
import { createCommandSchema, ackSchema } from '../validation.js';
import { CommandRepository } from '../repositories/command-repository.js';

const config = loadConfig();
const logger = createLogger();
const commandRepository = new CommandRepository(dbClient);

const ackHooks = {};

export function registerAckHook(type, handler) {
  ackHooks[type] = handler;
}

export async function createCommand(deviceId, type, payload = {}, opts = {}) {
  const { error, value } = createCommandSchema.validate({ deviceId, type, payload, ...opts });
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  if (!(await deviceExists(value.deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  return commandRepository.create({
    deviceId: value.deviceId,
    type: value.type,
    payload: value.payload,
    maxAttempts: value.maxAttempts || config.commandDefaultMaxAttempts,
    scheduledAt: value.scheduledAt
  });
}

export async function getCommand(commandId) {
  const command = await commandRepository.findById(commandId);
  if (!command) {
    throw Object.assign(new Error('Command not found'), { status: 404 });
  }
  return command;
}

export async function getLatestCommand(deviceId, type, status) {
  return commandRepository.findLatestByDeviceAndType(deviceId, type, status);
}

export async function listCommandsForDevice(deviceId, { limit = 50 } = {}) {
  if (!(await deviceExists(deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  return commandRepository.findByDevice(deviceId, { limit });
}

export async function acknowledgeCommand(commandId, deviceId, { status, response }) {
  const { error, value } = ackSchema.validate({ deviceId, status, response });
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  const internalStatus = value.status === 'success' ? 'acknowledged' : 'failed';
  const updated = await commandRepository.markAcknowledged(commandId, value.deviceId, {
    status: internalStatus,
    response: value.response
  });

  if (!updated) {
    throw Object.assign(new Error('Command not found or not awaiting acknowledgement'), { status: 409 });
  }

  const hook = ackHooks[updated.type];
  if (hook) {
    try {
      await hook(updated);
    } catch (err) {
      logger.error({ err, commandId: updated.id, type: updated.type }, 'Command ack hook failed');
    }
  }

  return updated;
}

export async function dispatchDueCommands() {
  const dueCommands = await commandRepository.findDue(50);
  let dispatched = 0;
  let expired = 0;

  for (const command of dueCommands) {
    if (command.status === 'sent' && command.attempts >= command.max_attempts) {
      await commandRepository.markExpired(command.id);
      expired += 1;
      continue;
    }

    await mqttClient.publish(
      `devices/${command.device_id}/commands`,
      JSON.stringify({ commandId: command.id, type: command.type, payload: command.payload })
    );

    const nextAttemptAt = new Date(Date.now() + config.commandAckTimeoutMs);
    await commandRepository.markSent(command.id, nextAttemptAt);
    dispatched += 1;
  }

  return { dispatched, expired };
}
