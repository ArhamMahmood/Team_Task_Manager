import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

/**
 * Apply every .sql file in migrations/ in filename order.
 * The files are written to be idempotent so this is safe on every boot.
 */
export async function runMigrations(client) {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await client.query(sql);
  }

  return files;
}
