import { loadConfig } from '../../../shared/config.js';
import { assertSafeWebhookUrl } from '../../../shared/url-safety.js';

const config = loadConfig();

export async function executeWebhook(actionConfig, context) {
  if (!actionConfig.url) {
    throw new Error('webhook action requires config.url');
  }
  assertSafeWebhookUrl(actionConfig.url, { allowPrivateTargets: config.allowPrivateWebhookTargets });

  const response = await fetch(actionConfig.url, {
    method: actionConfig.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(actionConfig.headers || {}) },
    body: JSON.stringify(actionConfig.body ?? context.payload),
    signal: AbortSignal.timeout(config.ruleWebhookTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Webhook responded with status ${response.status}`);
  }

  return { status: response.status };
}
