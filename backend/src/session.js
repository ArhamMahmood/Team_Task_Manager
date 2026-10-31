import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import memorystore from 'memorystore';
import { config } from './config.js';
import { pool } from './db.js';

/**
 * Sessions live in PostgreSQL (required by the brief).
 * Development falls back to an in-memory store when no database is configured.
 */
export function buildSessionMiddleware() {
  const store = buildStore();

  return session({
    name: config.cookieName,
    store,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
    },
  });
}

function buildStore() {
  if (pool) {
    const PgSession = connectPgSimple(session);
    return new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // seconds
    });
  }

  if (config.isProd) {
    throw new Error('A database is required for the session store in production.');
  }

  const MemoryStore = memorystore(session);
  console.warn('[session] No database configured - using in-memory session store (dev only).');
  return new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });
}
