import { createLogger } from '../../../shared/logger.js';

const logger = createLogger();

// TODO(future phase): integrate a real SMS provider (e.g. Twilio) once credentials exist.
// This stub logs the intended message and resolves successfully — there is no real
// failure mode to simulate, so it deliberately does not participate in the retry queue.
export async function sendSms(recipient, { body }) {
  logger.info({ recipient, body }, 'SMS channel (stub - no provider configured)');
  return { delivered: false, reason: 'SMS provider not yet configured' };
}
