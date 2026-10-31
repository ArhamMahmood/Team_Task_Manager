import { AppError } from '../lib/AppError.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found.`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const isKnown = err instanceof AppError;
  const status = isKnown ? err.status : 500;

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: {
      message: status >= 500 ? 'Something went wrong. Please try again.' : err.message,
      code: isKnown ? err.code : 'INTERNAL_ERROR',
      ...(isKnown && err.details ? { details: err.details } : {}),
    },
  });
}
