import { dbClient } from '../../../shared/database.js';
import { getDevice } from '../../devices/services/device-service.js';
import { createCommand } from '../../commands/services/command-service.js';
import { configSchema } from '../validation.js';
import { DeviceConfigurationRepository } from '../repositories/device-configuration-repository.js';

const deviceConfigurationRepository = new DeviceConfigurationRepository(dbClient);

export async function setDesiredConfig(deviceId, input) {
  const { error, value } = configSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  await getDevice(deviceId);

  const existing = await deviceConfigurationRepository.findByDevice(deviceId);
  const nextVersion = (existing?.desired_version ?? 0) + 1;

  const configuration = await deviceConfigurationRepository.upsertDesired(deviceId, {
    config: value.config,
    version: nextVersion
  });

  await createCommand(deviceId, 'config_update', { config: value.config, version: nextVersion });

  return configuration;
}

export async function getConfiguration(deviceId) {
  await getDevice(deviceId);

  const configuration = await deviceConfigurationRepository.findByDevice(deviceId);
  if (configuration) {
    return configuration;
  }

  return {
    device_id: deviceId,
    desired_config: null,
    desired_version: 0,
    reported_config: null,
    reported_version: null,
    updated_at: null
  };
}
