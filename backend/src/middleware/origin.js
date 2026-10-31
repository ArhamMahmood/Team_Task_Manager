import { AppError } from '../lib/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookie-based auth is only safe if state-changing requests come from our own
 * origin. SameSite=Lax already blocks most cross-site POSTs; this is a cheap
 * second layer. Requests without an Origin header (curl, health checks) pass.
 */
export function sameOriginOnly(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return next(new AppError(403, 'INVALID_ORIGIN', 'Request origin is invalid.'));
  }

  if (originHost === req.get('host')) return next();

  next(new AppError(403, 'INVALID_ORIGIN', 'Cross-origin request blocked.'));
}
