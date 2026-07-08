import { mqttClient } from '../../../shared/mqtt.js';

export async function executeMqttPublish(actionConfig, context) {
  if (!actionConfig.topic) {
    throw new Error('mqtt_publish action requires config.topic');
  }

  const topic = actionConfig.topic.replace('{deviceId}', context.deviceId);
  const payload = actionConfig.payload ?? context.payload;
  await mqttClient.publish(topic, JSON.stringify(payload));

  return { topic };
}
