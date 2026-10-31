import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { runMigrations } from './migrations.js';

async function main() {
  if (!pool) {
    throw new Error('A database is required to start the server.');
  }

  const applied = await runMigrations(pool);
  console.log(`[db] schema ready (${applied.length} migration file(s))`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received - shutting down`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
