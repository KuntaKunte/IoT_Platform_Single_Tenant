import { sendEmail } from './email.js';
import { sendSms } from './sms.js';
import { sendPush } from './push.js';
import { sendWebhook } from './webhook.js';

const channels = {
  email: sendEmail,
  sms: sendSms,
  push: sendPush,
  webhook: sendWebhook
};

export function registerChannel(type, fn) {
  if (channels[type]) {
    throw new Error(`Notification channel "${type}" is already registered`);
  }
  channels[type] = fn;
}

export function unregisterChannel(type) {
  delete channels[type];
}

export async function sendViaChannel(channel, recipient, message) {
  const sender = channels[channel];
  if (!sender) {
    throw new Error(`Unknown notification channel: ${channel}`);
  }
  return sender(recipient, message);
}
