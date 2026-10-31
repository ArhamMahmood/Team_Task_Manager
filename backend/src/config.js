import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const DEV_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/team_task';
const TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/team_task_test';
const DEV_SESSION_SECRET = 'dev-only-insecure-secret';

const databaseUrl =
  process.env.DATABASE_URL ?? (isProd ? '' : isTest ? TEST_DATABASE_URL : DEV_DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET ?? (isProd ? '' : DEV_SESSION_SECRET);

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set when NODE_ENV=production.');
}
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production.');
}

export const config = {
  nodeEnv,
  isProd,
  isTest,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl,
  sessionSecret,
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  cookieName: 'ttm.sid',
  cookieSecure:
    process.env.COOKIE_SECURE === undefined ? isProd : process.env.COOKIE_SECURE === 'true',
  serveStatic: isProd || process.env.SERVE_STATIC === 'true',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? (isTest ? 4 : 12)),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? (isTest ? 1000 : 20)),
};
