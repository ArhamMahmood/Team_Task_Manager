import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { agent, useTestDatabase } from './helpers.js';

useTestDatabase();

const registerVia = (client, path, email) =>
  client.post(path).send({ name: 'Alias User', email, password: 'password123' });

describe('unprefixed route aliases', () => {
  test('register, me and logout work under /auth', async () => {
    const client = agent();
    const email = `alias.auth.${Date.now()}@example.com`;

    const register = await registerVia(client, '/auth/register', email);
    assert.equal(register.status, 201);
    assert.equal(register.body.user.email, email);

    const me = await client.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);

    assert.equal((await client.post('/auth/logout')).status, 204);
    assert.equal((await client.get('/auth/me')).status, 401);
  });

  test('/teams and /tasks mirror the /api routes', async () => {
    const client = agent();
    const email = `alias.routes.${Date.now()}@example.com`;
    await registerVia(client, '/auth/register', email);

    const team = await client.post('/teams').send({ name: 'Alias Team' });
    assert.equal(team.status, 201);

    const viaApi = await client.get('/api/teams');
    const viaAlias = await client.get('/teams');
    assert.deepEqual(viaAlias.body, viaApi.body);

    const task = await client
      .post('/tasks')
      .send({ teamId: team.body.team.id, title: 'Alias task' });
    assert.equal(task.status, 201);
    assert.equal(task.body.task.title, 'Alias task');

    const list = await client.get('/tasks');
    assert.equal(list.status, 200);
    assert.equal(list.body.tasks.length, 1);

    const patched = await client.patch(`/tasks/${task.body.task.id}`).send({ status: 'done' });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.task.status, 'done');

    assert.equal((await client.delete(`/tasks/${task.body.task.id}`)).status, 204);
    assert.equal((await client.delete(`/teams/${team.body.team.id}`)).status, 204);
  });

  test('unknown aliased paths return a JSON 404 instead of the SPA', async () => {
    const client = agent();
    await registerVia(client, '/auth/register', `alias.404.${Date.now()}@example.com`);

    for (const path of ['/auth/nope', '/teams/1/nope', '/tasks/1/nope', '/users/nope']) {
      const res = await client.get(path);
      assert.equal(res.status, 404, path);
      assert.equal(res.body.error.code, 'NOT_FOUND', path);
    }
  });

  test('aliases still require authentication', async () => {
    for (const path of ['/auth/me', '/teams', '/tasks', '/users']) {
      const res = await agent().get(path);
      assert.equal(res.status, 401, path);
      assert.equal(res.body.error.code, 'UNAUTHENTICATED', path);
    }
  });
});
