/**
 * An error that is safe to expose to API clients.
 * Anything that is not an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
