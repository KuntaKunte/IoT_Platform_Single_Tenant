import { createLogger } from '../../shared/logger.js';
import { dispatchDueCommands } from './services/command-service.js';

const logger = createLogger();

export function startCommandDispatcher({ intervalMs }) {
  const timer = setInterval(async () => {
    try {
      const { dispatched, expired } = await dispatchDueCommands();
      if (dispatched || expired) {
        logger.info({ dispatched, expired }, 'Command dispatch sweep completed');
      }
    } catch (err) {
      logger.error({ err }, 'Command dispatch sweep failed');
    }
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
