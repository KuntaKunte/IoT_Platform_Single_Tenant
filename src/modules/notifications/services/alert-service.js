import { dbClient } from '../../../shared/database.js';
import { loadConfig } from '../../../shared/config.js';
import { deviceExists } from '../../devices/services/device-service.js';
import { createAlertSchema } from '../validation.js';
import { AlertRepository } from '../repositories/alert-repository.js';
import { NotificationDeliveryRepository } from '../repositories/notification-delivery-repository.js';

const config = loadConfig();
const alertRepository = new AlertRepository(dbClient);
const deliveryRepository = new NotificationDeliveryRepository(dbClient);

async function createDeliveriesForChannels(alertId, channels) {
  for (const channel of channels) {
    await deliveryRepository.create({
      alertId,
      channel: channel.type,
      recipient: channel.recipient,
      maxAttempts: config.notificationDefaultMaxAttempts
    });
  }
}

export async function createAlert(input) {
  const { error, value } = createAlertSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  if (value.deviceId != null && !(await deviceExists(value.deviceId))) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  const nextEscalationAt =
    value.escalationPolicy.length > 1 ? new Date(Date.now() + value.escalationPolicy[1].delayMs) : null;

  const alert = await alertRepository.create({
    source: value.source,
    ruleId: value.ruleId,
    deviceId: value.deviceId,
    severity: value.severity,
    title: value.title,
    message: value.message,
    templateId: value.templateId,
    templateData: value.templateData,
    escalationPolicy: value.escalationPolicy,
    escalationLevel: 0,
    nextEscalationAt
  });

  await createDeliveriesForChannels(alert.id, value.escalationPolicy[0].channels);

  return alert;
}

export async function getAlert(id) {
  const alert = await alertRepository.findById(id);
  if (!alert) {
    throw Object.assign(new Error('Alert not found'), { status: 404 });
  }
  return alert;
}

export async function listAlerts() {
  return alertRepository.findAll();
}

export async function acknowledgeAlert(id) {
  const alert = await alertRepository.acknowledge(id);
  if (!alert) {
    throw Object.assign(new Error('Alert not found or already acknowledged'), { status: 409 });
  }
  return alert;
}

export async function getAlertDeliveries(id) {
  await getAlert(id);
  return deliveryRepository.findByAlert(id);
}

export async function advanceDueEscalations() {
  const dueAlerts = await alertRepository.findDueEscalations(50);
  let escalated = 0;

  for (const alert of dueAlerts) {
    const nextLevel = alert.escalation_level + 1;
    const level = alert.escalation_policy[nextLevel];
    if (!level) {
      await alertRepository.advanceEscalation(alert.id, { escalationLevel: nextLevel, nextEscalationAt: null });
      continue;
    }

    await createDeliveriesForChannels(alert.id, level.channels);

    const followingLevel = alert.escalation_policy[nextLevel + 1];
    const nextEscalationAt = followingLevel ? new Date(Date.now() + followingLevel.delayMs) : null;
    await alertRepository.advanceEscalation(alert.id, { escalationLevel: nextLevel, nextEscalationAt });
    escalated += 1;
  }

  return { escalated };
}
