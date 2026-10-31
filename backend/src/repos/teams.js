import { query, withTransaction } from '../db.js';
import { AppError } from '../lib/AppError.js';

const TEAM_SELECT = `
  SELECT t.id,
         t.name,
         t.description,
         t.created_by,
         t.created_at,
         (SELECT count(*) FROM team_members m WHERE m.team_id = t.id)::int AS member_count,
         (SELECT count(*) FROM tasks k WHERE k.team_id = t.id)::int           AS task_count,
         (SELECT count(*) FROM tasks k WHERE k.team_id = t.id AND k.status <> 'done')::int AS open_task_count
    FROM teams t
`;

const mapTeam = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  createdBy: row.created_by,
  createdAt: row.created_at,
  memberCount: Number(row.member_count ?? 0),
  taskCount: Number(row.task_count ?? 0),
  openTaskCount: Number(row.open_task_count ?? 0),
});

const mapMember = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  joinedAt: row.joined_at,
  isOwner: row.is_owner,
});

export async function createTeam({ name, description, createdBy }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO teams (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_by, created_at`,
      [name, description || null, createdBy],
    );

    await client.query(`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`, [
      rows[0].id,
      createdBy,
    ]);

    return mapTeam({ ...rows[0], member_count: 1, task_count: 0, open_task_count: 0 });
  });
}

export async function listTeamsForUser(userId) {
  const { rows } = await query(
    `${TEAM_SELECT}
      JOIN team_members me ON me.team_id = t.id AND me.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId],
  );
  return rows.map(mapTeam);
}

/** Returns the team only if the user is a member; 404 otherwise (no leaking). */
export async function getTeamForUser(teamId, userId) {
  const { rows } = await query(
    `${TEAM_SELECT}
      JOIN team_members me ON me.team_id = t.id AND me.user_id = $2
     WHERE t.id = $1`,
    [teamId, userId],
  );
  if (!rows[0]) {
    throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found or you are not a member of it.');
  }
  return mapTeam(rows[0]);
}

export async function updateTeam(teamId, userId, changes) {
  const team = await getTeamForUser(teamId, userId);
  if (team.createdBy !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the team owner can edit this team.');
  }

  const sets = [];
  const values = [];
  if (changes.name !== undefined) {
    values.push(changes.name);
    sets.push(`name = $${values.length}`);
  }
  if (changes.description !== undefined) {
    values.push(changes.description || null);
    sets.push(`description = $${values.length}`);
  }
  values.push(teamId);

  const { rows } = await query(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $${values.length}
     RETURNING id, name, description, created_by, created_at`,
    values,
  );

  return mapTeam({
    ...rows[0],
    member_count: team.memberCount,
    task_count: team.taskCount,
    open_task_count: team.openTaskCount,
  });
}

export async function deleteTeam(teamId, userId) {
  const team = await getTeamForUser(teamId, userId);
  if (team.createdBy !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the team owner can delete this team.');
  }
  await query(`DELETE FROM teams WHERE id = $1`, [teamId]);
}

export async function isMember(teamId, userId) {
  const { rowCount } = await query(
    `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId],
  );
  return rowCount > 0;
}

export async function listMembers(teamId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, tm.joined_at, (t.created_by = u.id) AS is_owner
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN teams t ON t.id = tm.team_id
      WHERE tm.team_id = $1
      ORDER BY is_owner DESC, u.name ASC`,
    [teamId],
  );
  return rows.map(mapMember);
}

export async function addMember(teamId, userId) {
  const { rowCount } = await query(
    `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [teamId, userId],
  );
  if (rowCount === 0) {
    throw new AppError(409, 'ALREADY_MEMBER', 'That user is already a member of this team.');
  }
}

export async function removeMember(teamId, userId) {
  const { rowCount } = await query(
    `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId],
  );
  if (rowCount === 0) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'That user is not a member of this team.');
  }
}

export async function isOwner(teamId, userId) {
  const { rowCount } = await query(`SELECT 1 FROM teams WHERE id = $1 AND created_by = $2`, [
    teamId,
    userId,
  ]);
  return rowCount > 0;
}
