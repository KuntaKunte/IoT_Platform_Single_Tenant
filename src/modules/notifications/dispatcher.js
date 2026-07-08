import { createLogger } from '../../shared/logger.js';
import { dispatchDueNotifications } from './services/notification-service.js';

const logger = createLogger();

export function startNotificationDispatcher({ intervalMs }) {
  const timer = setInterval(async () => {
    try {
      const { dispatched, escalated } = await dispatchDueNotifications();
      if (dispatched || escalated) {
        logger.info({ dispatched, escalated }, 'Notification dispatch sweep completed');
      }
    } catch (err) {
      logger.error({ err }, 'Notification dispatch sweep failed');
    }
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
