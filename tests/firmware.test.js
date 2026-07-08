import request from 'supertest';
import app from '../src/app.js';
import { resetDatabase } from './helpers/reset-db.js';
import { createAdminToken, createUserWithRoles } from './helpers/auth.js';
import { dispatchDueCommands } from '../src/modules/commands/services/command-service.js';
import { mqttClient } from '../src/shared/mqtt.js';

describe('firmware & remote management endpoints', () => {
  let adminToken;
  let deviceId;
  let deviceApiKey;

  beforeAll(async () => {
    await mqttClient.connect();
  });

  afterAll(async () => {
    await mqttClient.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase();
    adminToken = await createAdminToken();

    const deviceResponse = await request(app)
      .post('/api/v1/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assetId: null, name: 'Firmware Target', deviceType: 'gateway' });
    deviceId = deviceResponse.body.device.id;

    const apiKeyResponse = await request(app)
      .post('/api/v1/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'firmware-device-key', roles: ['device'] });
    deviceApiKey = apiKeyResponse.body.apiKey;
  });

  async function uploadFirmware(version, deviceType = 'gateway', contents = `firmware-bytes-${version}`) {
    const response = await request(app)
      .post('/api/v1/firmware')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('deviceType', deviceType)
      .field('version', version)
      .field('description', `Firmware ${version}`)
      .attach('file', Buffer.from(contents), 'firmware.bin');
    return response;
  }

  it('uploads firmware and lets a device download the exact bytes back', async () => {
    const contents = 'the-real-firmware-payload';
    const uploadResponse = await uploadFirmware('1.0.0', 'gateway', contents);
    expect(uploadResponse.status).toBe(201);
    const firmwareId = uploadResponse.body.firmware.id;

    const listResponse = await request(app)
      .get('/api/v1/firmware')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listResponse.body.firmware.length).toBe(1);

    const downloadResponse = await request(app)
      .get(`/api/v1/firmware/${firmwareId}/download`)
      .set('x-api-key', deviceApiKey)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.body.toString()).toBe(contents);
  });

  it('rejects uploading the same device type/version twice', async () => {
    await uploadFirmware('1.0.0');
    const secondResponse = await uploadFirmware('1.0.0');
    expect(secondResponse.status).toBe(409);
  });

  it('deploys firmware, dispatches, acks, and reflects it as current; rolls back correctly', async () => {
    const v1 = await uploadFirmware('1.0.0');
    const v2 = await uploadFirmware('2.0.0');

    async function deployAndAck(firmwareId) {
      const deployResponse = await request(app)
        .post(`/api/v1/devices/${deviceId}/firmware/deploy`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firmwareId });
      expect(deployResponse.status).toBe(201);
      const commandId = deployResponse.body.deployment.command_id;

      await dispatchDueCommands();

      const ackResponse = await request(app)
        .post(`/api/v1/commands/${commandId}/ack`)
        .set('x-api-key', deviceApiKey)
        .send({ deviceId, status: 'success', response: { applied: true } });
      expect(ackResponse.status).toBe(200);

      return deployResponse.body.deployment;
    }

    await deployAndAck(v1.body.firmware.id);
    const currentAfterV1 = await request(app)
      .get(`/api/v1/devices/${deviceId}/firmware/current`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(currentAfterV1.body.current.firmware_id).toBe(v1.body.firmware.id);

    await deployAndAck(v2.body.firmware.id);
    const currentAfterV2 = await request(app)
      .get(`/api/v1/devices/${deviceId}/firmware/current`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(currentAfterV2.body.current.firmware_id).toBe(v2.body.firmware.id);

    const deploymentsResponse = await request(app)
      .get(`/api/v1/devices/${deviceId}/firmware/deployments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deploymentsResponse.body.deployments.length).toBe(2);

    const rollbackResponse = await request(app)
      .post(`/api/v1/devices/${deviceId}/firmware/rollback`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(rollbackResponse.status).toBe(201);
    expect(rollbackResponse.body.deployment.firmware_id).toBe(v1.body.firmware.id);
    expect(rollbackResponse.body.deployment.is_rollback).toBe(true);
  });

  it('rejects rollback with fewer than two successful deployments', async () => {
    const response = await request(app)
      .post(`/api/v1/devices/${deviceId}/firmware/rollback`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(response.status).toBe(409);
  });

  it('rejects deploying firmware built for a different device type', async () => {
    const otherTypeFirmware = await uploadFirmware('1.0.0', 'sensor');
    const response = await request(app)
      .post(`/api/v1/devices/${deviceId}/firmware/deploy`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firmwareId: otherTypeFirmware.body.firmware.id });
    expect(response.status).toBe(400);
  });

  it('pushes desired configuration and updates reported state via the ack hook', async () => {
    const setResponse = await request(app)
      .put(`/api/v1/devices/${deviceId}/configuration`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ config: { sampleRateMs: 5000 } });
    expect(setResponse.status).toBe(200);
    expect(setResponse.body.configuration.desired_version).toBe(1);

    await dispatchDueCommands();

    const commandsResponse = await request(app)
      .get(`/api/v1/commands/devices/${deviceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const configCommand = commandsResponse.body.commands.find((c) => c.type === 'config_update');
    expect(configCommand).toBeDefined();

    await request(app)
      .post(`/api/v1/commands/${configCommand.id}/ack`)
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, status: 'success', response: { config: { sampleRateMs: 5000 }, version: 1 } });

    const configResponse = await request(app)
      .get(`/api/v1/devices/${deviceId}/configuration`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(configResponse.body.configuration.reported_config).toEqual({ sampleRateMs: 5000 });
    expect(configResponse.body.configuration.reported_version).toBe(1);
  });

  it('requests diagnostics and returns the latest acknowledged result', async () => {
    const requestResponse = await request(app)
      .post(`/api/v1/devices/${deviceId}/diagnostics`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(requestResponse.status).toBe(201);
    const commandId = requestResponse.body.command.id;

    await dispatchDueCommands();
    await request(app)
      .post(`/api/v1/commands/${commandId}/ack`)
      .set('x-api-key', deviceApiKey)
      .send({ deviceId, status: 'success', response: { uptimeSeconds: 12345, freeMemoryKb: 512 } });

    const latestResponse = await request(app)
      .get(`/api/v1/devices/${deviceId}/diagnostics`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(latestResponse.body.diagnostics.response).toEqual({ uptimeSeconds: 12345, freeMemoryKb: 512 });
  });

  it('requests a log collection and lets a device upload the exact bytes for later download', async () => {
    const requestResponse = await request(app)
      .post(`/api/v1/devices/${deviceId}/logs`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(requestResponse.status).toBe(201);
    const collectionId = requestResponse.body.collection.id;
    expect(requestResponse.body.collection.status).toBe('requested');

    const logContents = 'line one\nline two\nline three\n';
    const uploadResponse = await request(app)
      .post(`/api/v1/devices/${deviceId}/logs/${collectionId}/upload`)
      .set('x-api-key', deviceApiKey)
      .attach('file', Buffer.from(logContents), 'device.log');
    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.collection.status).toBe('uploaded');

    const downloadResponse = await request(app)
      .get(`/api/v1/devices/${deviceId}/logs/${collectionId}/download`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.body.toString()).toBe(logContents);

    const listResponse = await request(app)
      .get(`/api/v1/devices/${deviceId}/logs`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listResponse.body.collections.length).toBe(1);
  });

  it('reboots a device via a plain command', async () => {
    const response = await request(app)
      .post(`/api/v1/devices/${deviceId}/reboot`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(201);
    expect(response.body.command.type).toBe('reboot');
    expect(response.body.command.status).toBe('pending');
  });

  it('rejects unauthenticated firmware upload', async () => {
    const response = await request(app)
      .post('/api/v1/firmware')
      .field('deviceType', 'gateway')
      .field('version', '1.0.0')
      .attach('file', Buffer.from('x'), 'firmware.bin');
    expect(response.status).toBe(401);
  });

  it('rejects a viewer-role token from deploying firmware', async () => {
    const { token: viewerToken } = await createUserWithRoles(['viewer']);
    const upload = await uploadFirmware('1.0.0');
    const response = await request(app)
      .post(`/api/v1/devices/${deviceId}/firmware/deploy`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ firmwareId: upload.body.firmware.id });
    expect(response.status).toBe(403);
  });

  it('rejects a firmware upload with no file attached', async () => {
    const response = await request(app)
      .post('/api/v1/firmware')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('deviceType', 'gateway')
      .field('version', '1.0.0');
    expect(response.status).toBe(400);
  });
});
