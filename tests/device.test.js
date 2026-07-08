import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';

describe('device platform endpoints', () => {
  let adminToken;

  beforeEach(async () => {
    await resetDatabase();
    adminToken = await createAdminToken();
  });

  it('creates a site, asset, device, and sensor hierarchy', async () => {
    const siteResponse = await request(app)
      .post('/api/v1/devices/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Plant A', location: 'Lagos' });
    expect(siteResponse.status).toBe(201);

    const assetResponse = await request(app)
      .post('/api/v1/devices/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ siteId: siteResponse.body.site.id, name: 'Line 1' });
    expect(assetResponse.status).toBe(201);

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: assetResponse.body.asset.id, name: 'Gateway-01', deviceType: 'gateway' });
    expect(deviceResponse.status).toBe(201);

    const sensorResponse = await request(app)
      .post('/api/v1/devices/sensors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceId: deviceResponse.body.device.id, name: 'Temperature', metric: 'temperature' });
    expect(sensorResponse.status).toBe(201);
  });

  it('searches devices by metadata and name', async () => {
    await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Gateway-Search', deviceType: 'gateway' });

    const response = await request(app)
      .get('/api/v1/devices/search?q=Gateway')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
  });

  it('provisions a device using a template', async () => {
    const response = await request(app)
      .post('/api/v1/devices/provision')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'temp-gateway', name: 'Gateway-02' });
    expect(response.status).toBe(201);
    expect(response.body.device).toMatchObject({ name: 'Gateway-02' });
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).post('/api/v1/devices/sites').send({ name: 'No Auth' });
    expect(response.status).toBe(401);
  });

  it('rejects requests from a viewer-role token on manage_devices routes', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const response = await request(app)
      .post('/api/v1/devices/sites')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Should Fail' });
    expect(response.status).toBe(403);
  });
});
