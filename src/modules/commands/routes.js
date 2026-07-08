import express from 'express';
import {
  createCommand,
  getCommand,
  listCommandsForDevice,
  acknowledgeCommand
} from './services/command-service.js';
import { authenticate, authenticateApiKey, requirePermission } from '../auth/middleware.js';

const router = express.Router();
const manageCommands = [authenticate, requirePermission('send_commands')];
const readOnly = [authenticate, requirePermission('read')];
const deviceAck = [authenticateApiKey, requirePermission('ack_commands')];

router.post('/', manageCommands, async (req, res, next) => {
  try {
    const { deviceId, type, payload, scheduledAt, maxAttempts } = req.body;
    const command = await createCommand(deviceId, type, payload, { scheduledAt, maxAttempts });
    res.status(201).json({ command });
  } catch (err) {
    next(err);
  }
});

router.get('/devices/:deviceId', readOnly, async (req, res, next) => {
  try {
    const deviceId = Number(req.params.deviceId);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'deviceId must be a positive integer' });
    }

    const commands = await listCommandsForDevice(deviceId);
    res.status(200).json({ deviceId, commands });
  } catch (err) {
    next(err);
  }
});

router.get('/:commandId', readOnly, async (req, res, next) => {
  try {
    const commandId = Number(req.params.commandId);
    if (!Number.isInteger(commandId) || commandId <= 0) {
      return res.status(400).json({ error: 'commandId must be a positive integer' });
    }

    const command = await getCommand(commandId);
    res.status(200).json({ command });
  } catch (err) {
    next(err);
  }
});

router.post('/:commandId/ack', deviceAck, async (req, res, next) => {
  try {
    const commandId = Number(req.params.commandId);
    if (!Number.isInteger(commandId) || commandId <= 0) {
      return res.status(400).json({ error: 'commandId must be a positive integer' });
    }

    const command = await acknowledgeCommand(commandId, req.body.deviceId, {
      status: req.body.status,
      response: req.body.response
    });
    res.status(200).json({ command });
  } catch (err) {
    next(err);
  }
});

export default router;
