import { createLogger } from '../../../shared/logger.js';

const logger = createLogger();

// TODO(future phase): integrate a real push provider (e.g. FCM/APNs) once credentials exist.
// This stub logs the intended message and resolves successfully — there is no real
// failure mode to simulate, so it deliberately does not participate in the retry queue.
export async function sendPush(recipient, { body }) {
  logger.info({ recipient, body }, 'Push channel (stub - no provider configured)');
  return { delivered: false, reason: 'Push provider not yet configured' };
}
