import Jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createMonitoringHooks } from '../../../shared/monitoring.js';
import { dbClient } from '../../../shared/database.js';
import { UserRepository } from '../repositories/user-repository.js';
import { ApiKeyRepository } from '../repositories/api-key-repository.js';

const monitoring = createMonitoringHooks();
const userRepository = new UserRepository(dbClient);
const apiKeyRepository = new ApiKeyRepository(dbClient);

const roles = {
  admin: ['read', 'write', 'manage_users', 'manage_devices', 'ingest_telemetry', 'send_commands', 'ack_commands', 'manage_rules', 'manage_notifications', 'manage_dashboards', 'manage_reports', 'manage_plugins'],
  manager: ['read', 'write', 'manage_devices', 'send_commands', 'manage_rules', 'manage_notifications', 'manage_dashboards', 'manage_reports'],
  viewer: ['read'],
  device: ['ingest_telemetry', 'ack_commands']
};

function createToken(user, type = 'access') {
  const secret = type === 'refresh' ? process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret' : process.env.JWT_SECRET || 'dev-secret';
  const expiresIn = type === 'refresh' ? '7d' : '15m';
  return Jwt.sign({ sub: user.id, email: user.email, roles: user.roles, type }, secret, { expiresIn });
}

export async function getUsers() {
  return userRepository.findAll();
}

export async function registerUser(email, password) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw Object.assign(new Error('User already exists'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({
    email,
    password_hash: passwordHash,
    roles: ['viewer']
  });

  monitoring.trackEvent('auth.registered', { email });
  return {
    user: { id: user.id, email: user.email, roles: user.roles },
    tokens: {
      accessToken: createToken(user),
      refreshToken: createToken(user, 'refresh')
    }
  };
}

export async function loginUser(email, password) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  monitoring.trackEvent('auth.logged_in', { email });
  return {
    user: { id: user.id, email: user.email, roles: user.roles },
    tokens: {
      accessToken: createToken(user),
      refreshToken: createToken(user, 'refresh')
    }
  };
}

export function getUserFromToken(token) {
  const payload = Jwt.verify(token, process.env.JWT_SECRET || 'dev-secret', { algorithms: ['HS256'] });
  return payload;
}

export function refreshTokens(refreshToken) {
  let payload;
  try {
    payload = Jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret', {
      algorithms: ['HS256']
    });
  } catch (_err) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  const user = { id: payload.sub, email: payload.email, roles: payload.roles };
  return {
    accessToken: createToken(user),
    refreshToken: createToken(user, 'refresh')
  };
}

export function canAccess(user, permission) {
  const effectiveRoles = user.roles || [];
  return effectiveRoles.some((role) => roles[role]?.includes(permission));
}

export async function createApiKey(name, requestedRoles = []) {
  const key = `sk_${crypto.randomBytes(24).toString('hex')}`;
  const normalizedRoles = requestedRoles.filter((role) => Object.hasOwn(roles, role));
  const entry = await apiKeyRepository.create({
    key,
    name,
    roles: normalizedRoles.length ? normalizedRoles : ['viewer']
  });

  monitoring.trackEvent('auth.api_key_created', { name });
  return { apiKey: entry.key, roles: entry.roles };
}

export async function validateApiKey(key) {
  const entry = await apiKeyRepository.findByKey(key);
  if (!entry) {
    throw Object.assign(new Error('Invalid API key'), { status: 401 });
  }
  return entry;
}

export async function requestPasswordReset(email) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    return { accepted: true };
  }

  await dbClient.query('UPDATE users SET password_reset_requested = true WHERE id = $1', [user.id]);
  monitoring.trackEvent('auth.password_reset_requested', { email });
  return { accepted: true };
}

export function getAuditEntries() {
  return monitoring.events;
}
