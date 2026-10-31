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

  return { owner, ownerUser, team, member, memberUser };
}

/** Use the database clock so the test and CURRENT_DATE can never disagree. */
async function currentDate() {
  const { rows } = await pool.query('SELECT CURRENT_DATE::text AS today');
  return rows[0].today;
}

function shiftDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const createTask = (client, payload) => client.post('/api/tasks').send(payload);

describe('due-date reminders', () => {
  test('returns overdue and due-today tasks assigned to the current user', async () => {
    const { owner, team, member, memberUser } = await setup();
    const today = await currentDate();

    await createTask(owner, {
      teamId: team.id,
      title: 'Overdue task',
      assignedTo: memberUser.id,
      dueDate: shiftDays(today, -2),
    });
    await createTask(owner, {
      teamId: team.id,
      title: 'Due today',
      assignedTo: memberUser.id,
      dueDate: today,
    });

    const res = await member.get('/api/tasks/reminders');

    assert.equal(res.status, 200);
    assert.equal(res.body.today, today);
    assert.deepEqual(
      res.body.overdue.map((task) => task.title),
      ['Overdue task'],
    );
    assert.deepEqual(
      res.body.dueToday.map((task) => task.title),
      ['Due today'],
    );
    assert.equal(res.body.count, 2);
  });

  test('excludes future, completed, unassigned and other users tasks', async () => {
    const { owner, ownerUser, team, member, memberUser } = await setup();
    const today = await currentDate();

    await createTask(owner, {
      teamId: team.id,
      title: 'Due tomorrow',
      assignedTo: memberUser.id,
      dueDate: shiftDays(today, 1),
    });
    await createTask(owner, {
      teamId: team.id,
      title: 'Already done',
      assignedTo: memberUser.id,
      status: 'done',
      dueDate: shiftDays(today, -1),
    });
    await createTask(owner, {
      teamId: team.id,
      title: 'Nobody owns this',
      dueDate: shiftDays(today, -1),
    });
    await createTask(owner, {
      teamId: team.id,
      title: 'Owner task',
      assignedTo: ownerUser.id,
      dueDate: shiftDays(today, -1),
    });

    const mine = await member.get('/api/tasks/reminders');
    assert.equal(mine.body.count, 0);
    assert.deepEqual(mine.body.overdue, []);
    assert.deepEqual(mine.body.dueToday, []);

    const theirs = await owner.get('/api/tasks/reminders');
    assert.deepEqual(
      theirs.body.overdue.map((task) => task.title),
      ['Owner task'],
    );
  });

  test('a removed member stops receiving reminders for that team', async () => {
    const { owner, team, member, memberUser } = await setup();
    const today = await currentDate();

    await createTask(owner, {
      teamId: team.id,
      title: 'Overdue task',
      assignedTo: memberUser.id,
      dueDate: shiftDays(today, -1),
    });

    assert.equal((await member.get('/api/tasks/reminders')).body.count, 1);
    assert.equal(
      (await owner.delete(`/api/teams/${team.id}/members/${memberUser.id}`)).status,
      204,
    );
    assert.equal((await member.get('/api/tasks/reminders')).body.count, 0);
  });

  test('is available through the unprefixed alias and requires auth', async () => {
    const { team, member, memberUser } = await setup();
    const today = await currentDate();

    await createTask(member, {
      teamId: team.id,
      title: 'Alias reminder',
      assignedTo: memberUser.id,
      dueDate: today,
    });

    const viaApi = await member.get('/api/tasks/reminders');
    const viaAlias = await member.get('/tasks/reminders');
    assert.equal(viaAlias.status, 200);
    assert.deepEqual(viaAlias.body, viaApi.body);

    const anonymous = await agent().get('/api/tasks/reminders');
    assert.equal(anonymous.status, 401);
  });
});
