import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';

describe('auth rate limiting', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('throttles repeated login attempts with a real 429 once the strict auth limiter is exceeded', async () => {
    const attempt = () =>
      request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'wrong-password' });

    const responses = [];
    for (let i = 0; i < 15; i += 1) {
      responses.push(await attempt());
    }

    const statuses = responses.map((response) => response.status);
    expect(statuses).toContain(401);
    expect(statuses).toContain(429);

    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.status).toBe(429);
  });
});
