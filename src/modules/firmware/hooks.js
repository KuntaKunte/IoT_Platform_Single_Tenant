import { dbClient } from '../../shared/database.js';
import { registerAckHook } from '../commands/services/command-service.js';
import { DeviceConfigurationRepository } from './repositories/device-configuration-repository.js';

const deviceConfigurationRepository = new DeviceConfigurationRepository(dbClient);

registerAckHook('config_update', async (command) => {
  if (command.status !== 'acknowledged') {
    return;
  }
  const appliedConfig = command.response?.config ?? command.payload?.config;
  const appliedVersion = command.response?.version ?? command.payload?.version;
  await deviceConfigurationRepository.updateReported(command.device_id, {
    config: appliedConfig,
    version: appliedVersion
  });
});
