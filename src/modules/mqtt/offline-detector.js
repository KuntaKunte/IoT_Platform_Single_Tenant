import { dbClient } from '../../shared/database.js';
import { createLogger } from '../../shared/logger.js';
import { DeviceStatusRepository } from './repositories/device-status-repository.js';

const logger = createLogger();
const deviceStatusRepository = new DeviceStatusRepository(dbClient);

// TODO(future phase): move this interval-based sweep into the charter's future Scheduler
// module; a per-process interval is acceptable for the single-instance-per-deployment model.
export function startOfflineDetector({ thresholdMs, intervalMs }) {
  const timer = setInterval(async () => {
    try {
      const staleDevices = await deviceStatusRepository.markStaleOffline(thresholdMs);
      if (staleDevices.length) {
        logger.info({ deviceIds: staleDevices.map((entry) => entry.device_id) }, 'Devices marked offline');
      }
    } catch (err) {
      logger.error({ err }, 'Offline detection sweep failed');
    }
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
