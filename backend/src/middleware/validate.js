import { AppError } from '../lib/AppError.js';

/**
 * Validates req.body / req.query / req.params against Joi schemas and exposes
 * the sanitized result on req.validated. Unknown keys are stripped, strings
 * are trimmed, and numbers are converted.
 */
export function validate(schemas) {
  return (req, res, next) => {
    const validated = {};

    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;

      const { value, error } = schema.validate(req[key] ?? {}, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        return next(
          new AppError(
            400,
            'VALIDATION_ERROR',
            'Invalid request data.',
            error.details.map((detail) => ({
              path: detail.path.join('.'),
              message: detail.message,
            })),
          ),
        );
      }

      validated[key] = value;
    }

    req.validated = validated;
    next();
  };
}
