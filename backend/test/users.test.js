import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { agent, register, useTestDatabase } from './helpers.js';

useTestDatabase();

describe('user search', () => {
  test('finds other users by name and email, excluding yourself', async () => {
    const alice = agent();
    await register(alice, { name: 'Alice Anderson', email: 'alice@example.com' });

    const bob = agent();
    await register(bob, { name: 'Bob Brown', email: 'bob@example.com' });

    const byName = await alice.get('/api/users?search=bob');
    assert.equal(byName.status, 200);
    assert.equal(byName.body.users.length, 1);
    assert.equal(byName.body.users[0].email, 'bob@example.com');

    const byEmail = await alice.get('/api/users?search=bob%40example');
    assert.equal(byEmail.body.users.length, 1);

    const everyone = await alice.get('/api/users');
    assert.equal(everyone.body.users.some((u) => u.email === 'alice@example.com'), false);
  });

  test('never exposes password hashes', async () => {
    const alice = agent();
    await register(alice, { name: 'Alice', email: 'alice@example.com' });

    const res = await alice.get('/api/users?search=alice');
    assert.equal(res.status, 200);
    for (const user of res.body.users) {
      assert.equal(user.passwordHash, undefined);
      assert.equal(user.password_hash, undefined);
    }
  });

  test('requires authentication', async () => {
    const res = await agent().get('/api/users?search=anything');
    assert.equal(res.status, 401);
  });
});
