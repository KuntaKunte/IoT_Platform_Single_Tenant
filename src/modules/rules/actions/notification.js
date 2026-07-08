import { createAlert } from '../../notifications/services/alert-service.js';

export async function executeNotification(actionConfig, context) {
  const escalationPolicy = actionConfig.escalationPolicy || [{ delayMs: 0, channels: actionConfig.channels || [] }];

  const alert = await createAlert({
    source: 'rule',
    deviceId: context.deviceId,
    severity: actionConfig.severity,
    title: actionConfig.title || 'Rule notification',
    message: actionConfig.message || '',
    templateId: actionConfig.templateId,
    templateData: { ...context.payload, ...actionConfig.templateData },
    escalationPolicy
  });

  return { delivered: true, alertId: alert.id };
}
