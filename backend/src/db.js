import pg from 'pg';
import { config } from './config.js';

// Keep DATE columns as plain YYYY-MM-DD strings instead of local-time Date objects.
pg.types.setTypeParser(1082, (value) => value);

/**
 * Build a pool config from a connection string.
 * Local Postgres runs without TLS; any managed host requires it.
 * `sslmode` is stripped because node-postgres configures TLS explicitly.
 */
export function buildPoolConfig(connectionString) {
  const url = new URL(connectionString);
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

/**
 * Cloud SQL from Cloud Run: the platform mounts a Unix socket per instance and
 * the connection is local to the VM, so TLS is neither needed nor supported.
 */
export function buildCloudSqlPoolConfig({ instanceConnectionName, user, password, database }) {
  return {
    host: `/cloudsql/${instanceConnectionName}`,
    user,
    password,
    database,
    ssl: false,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

function createPool() {
  if (config.cloudSql.instanceConnectionName) {
    return new pg.Pool(buildCloudSqlPoolConfig(config.cloudSql));
  }
  if (config.databaseUrl) {
    return new pg.Pool(buildPoolConfig(config.databaseUrl));
  }
  return null;
}

export const pool = createPool();

export async function query(text, params) {
  if (!pool) throw new Error('Database is not configured.');
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  if (!pool) throw new Error('Database is not configured.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
