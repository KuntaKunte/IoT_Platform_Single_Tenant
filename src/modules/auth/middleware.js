import { getUserFromToken, canAccess, validateApiKey } from './services/auth-service.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = header.split(' ')[1];
    req.user = getUserFromToken(token);
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authenticateOptional(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = header.split(' ')[1];
    req.user = getUserFromToken(token);
    next();
  } catch (_err) {
    req.user = null;
    next();
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !canAccess(req.user, permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export async function authenticateApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  try {
    req.apiKey = await validateApiKey(key);
    req.user = { roles: req.apiKey.roles };
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
}
