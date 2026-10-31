import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { agent, createTeam, register, useTestDatabase } from './helpers.js';

useTestDatabase();

async function setupOwnerAndTeam() {
  const owner = agent();
  const { user: ownerUser } = await register(owner, { name: 'Owner' });
  const { team } = await createTeam(owner);
  return { owner, ownerUser, team };
}

describe('teams', () => {
  test('creates a team, makes the creator a member and lists it', async () => {
    const { owner, team } = await setupOwnerAndTeam();

    assert.ok(team.id);
    assert.equal(team.memberCount, 1);
    assert.equal(team.taskCount, 0);

    const list = await owner.get('/api/teams');
    assert.equal(list.status, 200);
    assert.equal(list.body.teams.length, 1);
    assert.equal(list.body.teams[0].id, team.id);

    const members = await owner.get(`/api/teams/${team.id}/members`);
    assert.equal(members.status, 200);
    assert.equal(members.body.members.length, 1);
    assert.equal(members.body.members[0].isOwner, true);
  });

  test('adds a member by email and shows them in the member list', async () => {
    const { owner, team } = await setupOwnerAndTeam();

    const invitee = agent();
    const { email } = await register(invitee, { name: 'Invitee' });

    const add = await owner.post(`/api/teams/${team.id}/members`).send({ email });
    assert.equal(add.status, 201);

    const members = await owner.get(`/api/teams/${team.id}/members`);
    assert.equal(members.body.members.length, 2);
    assert.equal(members.body.members.some((m) => m.email === email), true);

    // The invitee can now see the team.
    const asMember = await invitee.get(`/api/teams/${team.id}`);
    assert.equal(asMember.status, 200);
  });

  test('rejects duplicate members and unknown emails', async () => {
    const { owner, team } = await setupOwnerAndTeam();
    const invitee = agent();
    const { email } = await register(invitee);

    assert.equal((await owner.post(`/api/teams/${team.id}/members`).send({ email })).status, 201);

    const duplicate = await owner.post(`/api/teams/${team.id}/members`).send({ email });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, 'ALREADY_MEMBER');

    const unknown = await owner
      .post(`/api/teams/${team.id}/members`)
      .send({ email: 'nobody@example.com' });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error.code, 'USER_NOT_FOUND');
  });

  test('non-members get a 404 instead of team details', async () => {
    const { team } = await setupOwnerAndTeam();
    const stranger = agent();
    await register(stranger);

    assert.equal((await stranger.get(`/api/teams/${team.id}`)).status, 404);
    assert.equal((await stranger.get(`/api/teams/${team.id}/members`)).status, 404);
    assert.equal((await stranger.get('/api/teams')).body.teams.length, 0);
  });

  test('only the owner can edit, add members or delete', async () => {
    const { owner, team } = await setupOwnerAndTeam();
    const member = agent();
    const { email } = await register(member);
    await owner.post(`/api/teams/${team.id}/members`).send({ email });

    const other = agent();
    const { email: otherEmail } = await register(other);

    assert.equal(
      (await member.patch(`/api/teams/${team.id}`).send({ name: 'Renamed' })).status,
      403,
    );
    assert.equal(
      (await member.post(`/api/teams/${team.id}/members`).send({ email: otherEmail })).status,
      403,
    );
    assert.equal((await member.delete(`/api/teams/${team.id}`)).status, 403);

    const renamed = await owner.patch(`/api/teams/${team.id}`).send({ name: 'Renamed' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.team.name, 'Renamed');
  });

  test('the owner cannot be removed from their own team', async () => {
    const { owner, ownerUser, team } = await setupOwnerAndTeam();

    const res = await owner.delete(`/api/teams/${team.id}/members/${ownerUser.id}`);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'CANNOT_REMOVE_OWNER');
  });

  test('deleting a team cascades to tasks and memberships', async () => {
    const { owner, team } = await setupOwnerAndTeam();

    await owner.post('/api/tasks').send({ teamId: team.id, title: 'Temporary task' });

    assert.equal((await owner.delete(`/api/teams/${team.id}`)).status, 204);
    assert.equal((await owner.get(`/api/teams/${team.id}`)).status, 404);

    const tasks = await pool.query('SELECT count(*)::int AS count FROM tasks');
    const members = await pool.query('SELECT count(*)::int AS count FROM team_members');
    assert.equal(tasks.rows[0].count, 0);
    assert.equal(members.rows[0].count, 0);
  });

  test('validates team payloads', async () => {
    const { owner } = await setupOwnerAndTeam();

    const res = await owner.post('/api/teams').send({ name: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');

    const badId = await owner.get('/api/teams/not-a-number');
    assert.equal(badId.status, 400);
  });
});
