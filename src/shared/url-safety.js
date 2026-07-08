// Blocks outbound requests (rule webhook action, notification webhook channel) from
// targeting loopback/private/link-local/cloud-metadata addresses — real SSRF hardening
// for a feature that lets an authenticated user (manage_rules/manage_notifications, not
// just admin) configure a URL the backend will fetch on their behalf.
//
// This checks the literal hostname/IP in the URL, not a DNS-resolved address, so it does
// not defend against DNS rebinding (a hostname that resolves to a public IP at request
// time but a private one when actually connected to). That's a known, accepted residual
// gap — closing it fully requires resolving DNS and re-checking the connecting socket's
// address, which is meaningfully more machinery than this pass's scope.

const BLOCKED_HOSTNAMES = new Set(['localhost', '169.254.169.254', 'metadata.google.internal']);

function isPrivateIPv4(hostname) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

export function assertSafeWebhookUrl(rawUrl, { allowPrivateTargets = false } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_err) {
    throw new Error('Invalid webhook URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Webhook URL must use http or https');
  }

  if (allowPrivateTargets) {
    return url;
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname === '::1' || isPrivateIPv4(hostname)) {
    throw new Error('Webhook URL targets a disallowed address');
  }

  return url;
}
