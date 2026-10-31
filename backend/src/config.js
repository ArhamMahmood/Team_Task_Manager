import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const DEV_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/team_task';
const TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/team_task_test';
const DEV_SESSION_SECRET = 'dev-only-insecure-secret';

const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME ?? '';
const dbUser = process.env.DB_USER ?? '';
const dbPassword = process.env.DB_PASSWORD ?? '';
const dbName = process.env.DB_NAME ?? '';

/**
 * Cloud Run talks to Cloud SQL over a Unix socket at /cloudsql/<instance>.
 * DATABASE_URL still covers local Docker, CI and any TCP-hosted Postgres.
 */
const usesCloudSql = instanceConnectionName !== '';

const databaseUrl =
  process.env.DATABASE_URL ??
  (isProd || usesCloudSql ? '' : isTest ? TEST_DATABASE_URL : DEV_DATABASE_URL);
const sessionSecret = process.env.SESSION_SECRET ?? (isProd ? '' : DEV_SESSION_SECRET);

if (!databaseUrl && !usesCloudSql) {
  throw new Error(
    'Set DATABASE_URL, or INSTANCE_CONNECTION_NAME + DB_USER + DB_NAME when NODE_ENV=production.',
  );
}
if (usesCloudSql && (!dbUser || !dbName)) {
  throw new Error('DB_USER and DB_NAME must be set when INSTANCE_CONNECTION_NAME is used.');
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
  cloudSql: {
    instanceConnectionName,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  },
  sessionSecret,
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  cookieName: 'ttm.sid',
  cookieSecure:
    process.env.COOKIE_SECURE === undefined ? isProd : process.env.COOKIE_SECURE === 'true',
  serveStatic: isProd || process.env.SERVE_STATIC === 'true',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? (isTest ? 4 : 12)),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? (isTest ? 1000 : 20)),
};
