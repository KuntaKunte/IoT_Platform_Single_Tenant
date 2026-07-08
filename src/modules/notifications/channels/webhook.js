import { loadConfig } from '../../../shared/config.js';
import { assertSafeWebhookUrl } from '../../../shared/url-safety.js';

const config = loadConfig();

export async function sendWebhook(recipient, { subject, body }) {
  assertSafeWebhookUrl(recipient, { allowPrivateTargets: config.allowPrivateWebhookTargets });

  const response = await fetch(recipient, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, body }),
    signal: AbortSignal.timeout(config.webhookNotificationTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Webhook responded with status ${response.status}`);
  }

  return { status: response.status };
}
