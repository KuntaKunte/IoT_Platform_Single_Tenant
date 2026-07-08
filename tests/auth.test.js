import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';

describe('auth endpoints', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('registers a new user and returns tokens', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'ops@example.com',
      password: 'StrongP@ssw0rd!'
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      user: { email: 'ops@example.com' },
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      }
    });
  });
});
