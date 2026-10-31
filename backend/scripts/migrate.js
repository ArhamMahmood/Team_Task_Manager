import { pool } from '../src/db.js';
import { runMigrations } from '../src/migrations.js';

const files = await runMigrations(pool);
console.log(`Applied ${files.length} migration file(s): ${files.join(', ')}`);
await pool.end();
