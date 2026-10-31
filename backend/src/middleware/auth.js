import { AppError } from '../lib/AppError.js';

/** Every non-auth route is mounted behind this. */
export function requireAuth(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  next(new AppError(401, 'UNAUTHENTICATED', 'You must be signed in to do that.'));
}
