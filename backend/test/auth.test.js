import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { pool } from '../src/db.js';
import { agent, register, uniqueEmail, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('auth', () => {
  test('registers a user, sets an HTTP-only cookie and keeps the session', async () => {
    const client = agent();
    const { res, email } = await register(client);

    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, email);
    assert.equal(res.body.user.passwordHash, undefined);

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);
  });

  test('stores a bcrypt hash, never the plain password', async () => {
    const client = agent();
    const { email, password } = await register(client);

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].password_hash, password);
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare(password, rows[0].password_hash), true);
  });

  test('rejects duplicate emails (case-insensitive)', async () => {
    const first = agent();
    const { email } = await register(first);

    const second = agent();
    const res = await second
      .post('/api/auth/register')
      .send({ name: 'Other', email: email.toUpperCase(), password: 'password123' });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  test('rejects invalid registration payloads with field details', async () => {
    const client = agent();
    const res = await client
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.length >= 3);
  });

  test('logs in with valid credentials', async () => {
    const owner = agent();
    const { email, password } = await register(owner);

    const client = agent();
    const res = await client.post('/api/auth/login').send({ email, password });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);

    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
  });

  test('rejects a wrong password and an unknown account identically', async () => {
    const owner = agent();
    const { email } = await register(owner);

    const wrongPassword = await agent()
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' });

    const unknownAccount = await agent()
      .post('/api/auth/login')
      .send({ email: uniqueEmail('ghost'), password: 'password123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownAccount.status, 401);
    assert.deepEqual(wrongPassword.body, unknownAccount.body);
  });

  test('logout destroys the session', async () => {
    const client = agent();
    await register(client);

    assert.equal((await client.get('/api/auth/me')).status, 200);
    assert.equal((await client.post('/api/auth/logout')).status, 204);
    assert.equal((await client.get('/api/auth/me')).status, 401);
  });

  test('protected routes reject anonymous requests', async () => {
    const client = agent();

    for (const path of ['/api/auth/me', '/api/teams', '/api/tasks', '/api/users']) {
      const res = await client.get(path);
      assert.equal(res.status, 401, `${path} should require auth`);
      assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    }
  });

  test('sanitizes unknown fields out of the payload', async () => {
    const client = agent();
    const res = await client.post('/api/auth/register').send({
      name: '  Spacey Name  ',
      email: '  MIXED.Case@Example.com ',
      password: 'password123',
      isAdmin: true,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.name, 'Spacey Name');
    assert.equal(res.body.user.email, 'mixed.case@example.com');
    assert.equal(res.body.user.isAdmin, undefined);
  });
});
