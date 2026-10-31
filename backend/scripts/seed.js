import bcrypt from 'bcrypt';
import { config } from '../src/config.js';
import { pool } from '../src/db.js';
import { runMigrations } from '../src/migrations.js';
import { createUser, findUserByEmail } from '../src/repos/users.js';
import { addMember, createTeam, isMember, listTeamsForUser } from '../src/repos/teams.js';
import { createTask, listTasks } from '../src/repos/tasks.js';

const PASSWORD = 'password123';
const TEAM_NAME = 'Website Redesign';

async function main() {
  await runMigrations(pool);

  const passwordHash = await bcrypt.hash(PASSWORD, config.bcryptRounds);

  const demo = (await findUserByEmail('demo@example.com')) ??
    (await createUser({ name: 'Demo User', email: 'demo@example.com', passwordHash }));
  const mia = (await findUserByEmail('mia@example.com')) ??
    (await createUser({ name: 'Mia Member', email: 'mia@example.com', passwordHash }));

  const teams = await listTeamsForUser(demo.id);
  const team =
    teams.find((candidate) => candidate.name === TEAM_NAME) ??
    (await createTeam({
      name: TEAM_NAME,
      description: 'Refresh the marketing site and ship it this quarter.',
      createdBy: demo.id,
    }));

  if (!(await isMember(team.id, mia.id))) {
    await addMember(team.id, mia.id);
  }

  const existingTasks = await listTasks({ userId: demo.id, teamId: team.id });
  if (existingTasks.length === 0) {
    const seedTasks = [
      {
        title: 'Design homepage hero',
        description: 'Pick the hero image and finalise the headline.',
        status: 'in_progress',
        assignedTo: demo.id,
        dueDate: '2026-11-20',
      },
      {
        title: 'Write API documentation',
        description: 'Document every endpoint with request and response examples.',
        status: 'todo',
        assignedTo: mia.id,
        dueDate: '2026-11-18',
      },
      {
        title: 'Set up CI pipeline',
        description: 'Run tests and build on every pull request.',
        status: 'todo',
        assignedTo: null,
        dueDate: null,
      },
      {
        title: 'Review copy with marketing',
        description: 'Final pass on the landing page copy.',
        status: 'done',
        assignedTo: demo.id,
        dueDate: null,
      },
    ];

    for (const task of seedTasks) {
      await createTask({ ...task, teamId: team.id, createdBy: demo.id });
    }
  }

  console.log('Seed complete.');
  console.log(`  Team:     ${TEAM_NAME} (id ${team.id})`);
  console.log('  Owner:    demo@example.com / password123');
  console.log('  Member:   mia@example.com / password123');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
