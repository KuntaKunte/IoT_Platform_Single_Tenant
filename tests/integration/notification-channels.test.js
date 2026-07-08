import http from 'http';
import { sendEmail } from '../../src/modules/notifications/channels/email.js';
import { sendWebhook } from '../../src/modules/notifications/channels/webhook.js';
import { sendSms } from '../../src/modules/notifications/channels/sms.js';
import { sendPush } from '../../src/modules/notifications/channels/push.js';

const MAILPIT_BASE = 'http://localhost:8025/api/v1';

async function clearMailpit() {
  await fetch(`${MAILPIT_BASE}/messages`, { method: 'DELETE' });
}

async function getMailpitMessages() {
  const response = await fetch(`${MAILPIT_BASE}/messages`);
  return response.json();
}

describe('notification channel providers', () => {
  beforeEach(async () => {
    await clearMailpit();
  });

  it('sendEmail delivers a real message via Mailpit', async () => {
    await sendEmail('channel-test@example.com', { subject: 'Channel Test', body: 'Hello from the channel test' });

    const mail = await getMailpitMessages();
    expect(mail.messages_count).toBe(1);
    expect(mail.messages[0].To[0].Address).toBe('channel-test@example.com');
    expect(mail.messages[0].Subject).toBe('Channel Test');
  });

  it('sendWebhook performs a real HTTP POST', async () => {
    const receivedBodies = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        receivedBodies.push(JSON.parse(raw));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    const result = await sendWebhook(`http://127.0.0.1:${port}/hook`, { subject: 'Webhook Test', body: 'payload' });

    expect(result.status).toBe(200);
    expect(receivedBodies).toEqual([{ subject: 'Webhook Test', body: 'payload' }]);

    await new Promise((resolve) => server.close(resolve));
  });

  it('sendSms is a documented stub that resolves without a real provider', async () => {
    const result = await sendSms('+15550000000', { body: 'Temperature high' });
    expect(result).toEqual({ delivered: false, reason: expect.any(String) });
  });

  it('sendPush is a documented stub that resolves without a real provider', async () => {
    const result = await sendPush('device-token-123', { body: 'Temperature high' });
    expect(result).toEqual({ delivered: false, reason: expect.any(String) });
  });
});
