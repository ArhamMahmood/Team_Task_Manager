import { after, before, beforeEach } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { runMigrations } from '../src/migrations.js';

export const app = createApp();

/** Wire up schema creation, per-test truncation and pool teardown. */
export function useTestDatabase() {
  before(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE users, teams, tasks, team_members, session RESTART IDENTITY CASCADE',
    );
  });

  after(async () => {
    await pool.end();
  });
}

/** A supertest agent keeps the session cookie between requests. */
export const agent = () => request.agent(app);

let counter = 0;

export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${counter}.${Date.now()}@example.com`;
}

export async function register(agentInstance, overrides = {}) {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'password123';

  const res = await agentInstance
    .post('/api/auth/register')
    .send({ name: overrides.name ?? 'Test User', email, password });

  return { res, email, password, user: res.body.user };
}

export async function createTeam(agentInstance, overrides = {}) {
  const res = await agentInstance
    .post('/api/teams')
    .send({ name: overrides.name ?? 'Team Alpha', description: overrides.description ?? '' });

  return { res, team: res.body.team };
}
