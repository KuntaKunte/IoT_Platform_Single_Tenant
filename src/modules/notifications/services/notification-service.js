import { dbClient } from '../../../shared/database.js';
import { loadConfig } from '../../../shared/config.js';
import { createLogger } from '../../../shared/logger.js';
import { sendViaChannel } from '../channels/index.js';
import { renderTemplate } from './template-service.js';
import { advanceDueEscalations } from './alert-service.js';
import { AlertRepository } from '../repositories/alert-repository.js';
import { NotificationDeliveryRepository } from '../repositories/notification-delivery-repository.js';
import { TemplateRepository } from '../repositories/template-repository.js';

const config = loadConfig();
const logger = createLogger();
const alertRepository = new AlertRepository(dbClient);
const deliveryRepository = new NotificationDeliveryRepository(dbClient);
const templateRepository = new TemplateRepository(dbClient);

async function renderMessage(alert) {
  if (!alert.template_id) {
    return { subject: alert.title, body: alert.message };
  }

  const template = await templateRepository.findById(alert.template_id);
  if (!template) {
    return { subject: alert.title, body: alert.message };
  }

  const data = { title: alert.title, message: alert.message, severity: alert.severity, ...alert.template_data };
  return {
    subject: template.subject_template ? renderTemplate(template.subject_template, data) : alert.title,
    body: renderTemplate(template.body_template, data)
  };
}

export async function dispatchDelivery(delivery) {
  const alert = await alertRepository.findById(delivery.alert_id);
  const { subject, body } = await renderMessage(alert);

  try {
    await sendViaChannel(delivery.channel, delivery.recipient, { subject, body });
    await deliveryRepository.markSent(delivery.id);
  } catch (err) {
    if (delivery.attempts + 1 >= delivery.max_attempts) {
      await deliveryRepository.markFailed(delivery.id, err.message);
    } else {
      const nextAttemptAt = new Date(Date.now() + config.notificationRetryBackoffMs);
      await deliveryRepository.markRetry(delivery.id, nextAttemptAt, err.message);
    }
  }
}

export async function dispatchDueNotifications() {
  const dueDeliveries = await deliveryRepository.findDue(50);
  for (const delivery of dueDeliveries) {
    try {
      await dispatchDelivery(delivery);
    } catch (err) {
      logger.error({ err, deliveryId: delivery.id }, 'Notification delivery dispatch failed unexpectedly');
    }
  }

  const { escalated } = await advanceDueEscalations();

  return { dispatched: dueDeliveries.length, escalated };
}
