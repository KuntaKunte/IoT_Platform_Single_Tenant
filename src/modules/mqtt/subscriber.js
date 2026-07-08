import { mqttClient } from '../../shared/mqtt.js';
import { createLogger } from '../../shared/logger.js';
import { enqueueTelemetry, recordHeartbeat } from './services/mqtt-service.js';
import { acknowledgeCommand } from '../commands/services/command-service.js';

const logger = createLogger();
const TELEMETRY_FILTER = 'devices/+/telemetry';
const HEARTBEAT_FILTER = 'devices/+/heartbeat';
const COMMAND_ACK_FILTER = 'devices/+/commands/ack';

function parseTopic(topic) {
  const [, deviceIdPart, kind, subKind] = topic.split('/');
  return { deviceId: Number(deviceIdPart), kind, subKind };
}

export async function startMqttSubscriber() {
  await mqttClient.connect();
  await mqttClient.subscribe([TELEMETRY_FILTER, HEARTBEAT_FILTER, COMMAND_ACK_FILTER]);

  mqttClient.onMessage(async (topic, payloadBuffer) => {
    try {
      const { deviceId, kind, subKind } = parseTopic(topic);
      if (!Number.isInteger(deviceId)) {
        logger.warn({ topic }, 'Ignoring MQTT message with non-numeric device id');
        return;
      }

      if (kind === 'telemetry') {
        let payload;
        try {
          payload = JSON.parse(payloadBuffer.toString());
        } catch (parseErr) {
          logger.warn({ topic, err: parseErr }, 'Dropping telemetry message with invalid JSON payload');
          return;
        }
        await enqueueTelemetry(deviceId, topic, payload);
      } else if (kind === 'heartbeat') {
        await recordHeartbeat(deviceId);
      } else if (kind === 'commands' && subKind === 'ack') {
        let ack;
        try {
          ack = JSON.parse(payloadBuffer.toString());
        } catch (parseErr) {
          logger.warn({ topic, err: parseErr }, 'Dropping command ack with invalid JSON payload');
          return;
        }
        await acknowledgeCommand(ack.commandId, deviceId, { status: ack.status, response: ack.response });
      }
    } catch (err) {
      logger.error({ err, topic }, 'Failed to process MQTT message');
    }
  });

  return mqttClient;
}
