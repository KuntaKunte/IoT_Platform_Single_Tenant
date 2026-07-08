import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken } from './helpers/auth.js';

describe('security endpoints', () => {
  let adminToken;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await createAdminToken();
  });

  it('issues tokens and supports a protected route with RBAC', async () => {
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      email: 'security@example.com',
      password: 'StrongP@ssw0rd!'
    });

    const token = registerResponse.body.tokens.accessToken;
    const protectedResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body.user.email).toBe('security@example.com');
  });

  it('requires an authenticated admin to mint an API key', async () => {
    const unauthenticatedResponse = await request(app).post('/api/v1/auth/api-keys').send({
      name: 'anonymous-key',
      roles: ['admin']
    });
    expect(unauthenticatedResponse.status).toBe(401);
  });

  it('accepts a valid API key for a protected endpoint once minted by an admin', async () => {
    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'service-key', roles: ['viewer'] });

    const apiKey = apiKeyResponse.body.apiKey;
    const response = await request(app)
      .get('/api/v1/auth/metadata')
      .set('x-api-key', apiKey);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
  });

  it('supports password reset request flow', async () => {
    const response = await request(app).post('/api/v1/auth/password-reset').send({
      email: 'security@example.com'
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ accepted: true });
  });

  it('issues a new valid access token from a refresh token', async () => {
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'security@example.com',
      password: 'StrongP@ssw0rd!'
    });
    const { refreshToken } = loginResponse.body.tokens;

    const refreshResponse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.tokens.accessToken).toEqual(expect.any(String));

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshResponse.body.tokens.accessToken}`);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe('security@example.com');
  });

  it('rejects a refresh with an access token instead of a refresh token', async () => {
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'security@example.com',
      password: 'StrongP@ssw0rd!'
    });
    const { accessToken } = loginResponse.body.tokens;

    const refreshResponse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: accessToken });
    expect(refreshResponse.status).toBe(401);
  });
});
