import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { agent, createTeam, register, useTestDatabase } from './helpers.js';

useTestDatabase();

async function setup() {
  const owner = agent();
  const { user: ownerUser } = await register(owner, { name: 'Owner' });
  const { team } = await createTeam(owner);

  const member = agent();
  const { user: memberUser, email: memberEmail } = await register(member, { name: 'Member' });
  await owner.post(`/api/teams/${team.id}/members`).send({ email: memberEmail });

  const other = agent();
  await register(other, { name: 'Other' });

  return { owner, ownerUser, team, member, memberUser, other };
}

const createTask = (client, payload) => client.post('/api/tasks').send(payload);

describe('tasks', () => {
  test('creates a task with defaults and lists it for team members', async () => {
    const { owner, team, member } = await setup();

    const res = await createTask(owner, { teamId: team.id, title: 'Write the README' });
    assert.equal(res.status, 201);
    assert.equal(res.body.task.status, 'todo');
    assert.equal(res.body.task.assignedTo, null);
    assert.equal(res.body.task.teamName, team.name);

    const list = await member.get('/api/tasks');
    assert.equal(list.status, 200);
    assert.equal(list.body.tasks.length, 1);
    assert.equal(list.body.tasks[0].title, 'Write the README');
  });

  test('assigns a task to a team member and exposes the assignee name', async () => {
    const { owner, team, memberUser, member } = await setup();

    const res = await createTask(owner, {
      teamId: team.id,
      title: 'Ship it',
      assignedTo: memberUser.id,
      status: 'in_progress',
      dueDate: '2026-11-15',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.task.assignedTo, memberUser.id);
    assert.equal(res.body.task.assigneeName, 'Member');
    assert.equal(res.body.task.status, 'in_progress');
    assert.equal(res.body.task.dueDate, '2026-11-15');

    const mine = await member.get(`/api/tasks?assigneeId=${memberUser.id}`);
    assert.equal(mine.body.tasks.length, 1);
  });

  test('refuses to assign a task to a non-member', async () => {
    const { owner, team, other } = await setup();

    const outsider = await other.get('/api/auth/me');
    const res = await createTask(owner, {
      teamId: team.id,
      title: 'Nope',
      assignedTo: outsider.body.user.id,
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ASSIGNEE');
  });

  test('refuses to create a task in a team you do not belong to', async () => {
    const { team, other } = await setup();

    const res = await createTask(other, { teamId: team.id, title: 'Intruder task' });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'TEAM_NOT_FOUND');
  });

  test('hides tasks from users outside the team', async () => {
    const { owner, team, other } = await setup();
    const created = await createTask(owner, { teamId: team.id, title: 'Secret task' });

    assert.equal((await other.get('/api/tasks')).body.tasks.length, 0);
    assert.equal((await other.get(`/api/tasks/${created.body.task.id}`)).status, 404);
  });

  test('filters by team, assignee, status and search term', async () => {
    const { owner, team, memberUser, member } = await setup();
    const second = await createTeam(owner, { name: 'Team Beta' });

    await createTask(owner, { teamId: team.id, title: 'Alpha one', assignedTo: memberUser.id });
    await createTask(owner, { teamId: team.id, title: 'Beta two', status: 'done' });
    await createTask(owner, { teamId: second.team.id, title: 'Gamma three' });

    const byTeam = await member.get(`/api/tasks?teamId=${team.id}`);
    assert.equal(byTeam.body.tasks.length, 2);

    const byAssignee = await member.get(`/api/tasks?assigneeId=${memberUser.id}`);
    assert.equal(byAssignee.body.tasks.length, 1);
    assert.equal(byAssignee.body.tasks[0].title, 'Alpha one');

    const byStatus = await member.get('/api/tasks?status=done');
    assert.equal(byStatus.body.tasks.length, 1);
    assert.equal(byStatus.body.tasks[0].title, 'Beta two');

    const bySearch = await member.get('/api/tasks?q=ALPHA');
    assert.equal(bySearch.body.tasks.length, 1);
    assert.equal(bySearch.body.tasks[0].title, 'Alpha one');

    const combined = await member.get(`/api/tasks?teamId=${team.id}&status=done`);
    assert.equal(combined.body.tasks.length, 1);
  });

  test('updates a task and refreshes updatedAt', async () => {
    const { owner, team, member, memberUser } = await setup();
    const created = await createTask(owner, { teamId: team.id, title: 'Initial title' });

    const res = await member
      .patch(`/api/tasks/${created.body.task.id}`)
      .send({ title: 'Updated title', status: 'done', assignedTo: memberUser.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.task.title, 'Updated title');
    assert.equal(res.body.task.status, 'done');
    assert.equal(res.body.task.assigneeName, 'Member');
    assert.notEqual(res.body.task.updatedAt, created.body.task.updatedAt);
  });

  test('only the task creator or team owner can delete a task', async () => {
    const { owner, team, member } = await setup();
    const byMember = await createTask(member, { teamId: team.id, title: 'Member task' });
    const byOwner = await createTask(owner, { teamId: team.id, title: 'Owner task' });

    const outsider = agent();
    const { email } = await register(outsider, { name: 'Third wheel' });
    await owner.post(`/api/teams/${team.id}/members`).send({ email });

    assert.equal(
      (await outsider.delete(`/api/tasks/${byOwner.body.task.id}`)).status,
      403,
    );
    assert.equal((await member.delete(`/api/tasks/${byOwner.body.task.id}`)).status, 403);

    // Creator can delete their own task, owner can delete any task.
    assert.equal((await member.delete(`/api/tasks/${byMember.body.task.id}`)).status, 204);
    assert.equal((await owner.delete(`/api/tasks/${byOwner.body.task.id}`)).status, 204);
  });

  test('validates task input', async () => {
    const { owner, team } = await setup();

    const missingTitle = await createTask(owner, { teamId: team.id });
    assert.equal(missingTitle.status, 400);

    const badStatus = await createTask(owner, {
      teamId: team.id,
      title: 'Bad status',
      status: 'archived',
    });
    assert.equal(badStatus.status, 400);

    const badFilter = await owner.get('/api/tasks?limit=1000');
    assert.equal(badFilter.status, 400);
  });

  test('a removed member loses access to team tasks', async () => {
    const { owner, team, member, memberUser } = await setup();
    await createTask(owner, { teamId: team.id, title: 'Still here' });

    assert.equal((await member.get('/api/tasks')).body.tasks.length, 1);
    assert.equal(
      (await owner.delete(`/api/teams/${team.id}/members/${memberUser.id}`)).status,
      204,
    );
    assert.equal((await member.get('/api/tasks')).body.tasks.length, 0);

    const { rows } = await pool.query('SELECT count(*)::int AS count FROM team_members');
    assert.equal(rows[0].count, 1);
  });
});
