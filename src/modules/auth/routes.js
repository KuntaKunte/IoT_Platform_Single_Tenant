import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  registerUser,
  loginUser,
  createApiKey,
  requestPasswordReset,
  getAuditEntries,
  refreshTokens
} from './services/auth-service.js';
import { authenticate, requirePermission, authenticateApiKey } from './middleware.js';
import { registerSchema, loginSchema, apiKeySchema, passwordResetSchema, refreshSchema } from './validation.js';
import { loadConfig } from '../../shared/config.js';

const config = loadConfig();
const router = express.Router();

// Strict limiter for credential-facing routes — real brute-force/credential-stuffing
// protection, separate from the much more generous general API limiter in app.js.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await registerUser(value.email, value.password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await loginUser(value.email, value.password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const { value, error } = refreshSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const tokens = refreshTokens(value.refreshToken);
    res.status(200).json({ tokens });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, requirePermission('read'), (req, res) => {
  res.status(200).json({ user: req.user });
});

router.post('/api-keys', authenticate, requirePermission('manage_users'), async (req, res, next) => {
  try {
    const { value, error } = apiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await createApiKey(value.name, value.roles);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/password-reset', async (req, res, next) => {
  try {
    const { value, error } = passwordResetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await requestPasswordReset(value.email);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/metadata', authenticateApiKey, (_req, res) => {
  res.status(200).json({ ok: true });
});

router.get('/audit-logs', authenticate, requirePermission('manage_users'), (_req, res) => {
  res.status(200).json({ entries: getAuditEntries() });
});

export default router;
