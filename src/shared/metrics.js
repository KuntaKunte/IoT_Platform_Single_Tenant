import client from 'prom-client';

export const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, labeled by method/route/status_code',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// Every module router is mounted at one of these fixed prefixes in app.js. Sorted
// longest-first so a request under /api/v1/devices/:id/firmware/... (mounted twice,
// once for CRUD and once for firmware sub-routes) still matches deterministically.
const MOUNT_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/devices',
  '/api/v1/mqtt',
  '/api/v1/commands',
  '/api/v1/rules',
  '/api/v1/notifications',
  '/api/v1/dashboards',
  '/api/v1/reports',
  '/api/v1/firmware',
  '/api/v1/plugins'
].sort((a, b) => b.length - a.length);

function findMountPrefix(originalUrl) {
  const pathname = originalUrl.split('?')[0];
  return MOUNT_PREFIXES.find((prefix) => pathname.startsWith(prefix)) || '';
}

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  const originalEnd = res.end;

  // req.baseUrl is mutated by Express as it walks back up the router stack looking
  // for an error handler (next(err)) — since the app's error handler lives at the
  // top level, any thrown error resets req.baseUrl to '' on the way there, while
  // req.route (set once, never reset) still holds the locally-matched path. That
  // combination silently produces a route label missing its module prefix for a
  // large fraction of error responses (every `catch (err) { next(err) }` in this
  // codebase). Reconstructing the prefix from the untouched req.originalUrl instead
  // of trusting req.baseUrl sidesteps the whole problem.
  res.end = function patchedEnd(...args) {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route ? `${findMountPrefix(req.originalUrl)}${req.route.path}` : 'unmatched';
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      durationSeconds
    );
    return originalEnd.apply(res, args);
  };

  next();
}
