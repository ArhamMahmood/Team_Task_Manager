import { query } from '../db.js';
import { AppError } from '../lib/AppError.js';

const TASK_SELECT = `
  SELECT k.id,
         k.team_id,
         k.title,
         k.description,
         k.status,
         k.assigned_to,
         k.created_by,
         k.due_date,
         k.created_at,
         k.updated_at,
         a.name AS assignee_name,
         t.name AS team_name
    FROM tasks k
    JOIN teams t ON t.id = k.team_id
    LEFT JOIN users a ON a.id = k.assigned_to
`;

const mapTask = (row) => ({
  id: row.id,
  teamId: row.team_id,
  teamName: row.team_name,
  title: row.title,
  description: row.description ?? '',
  status: row.status,
  assignedTo: row.assigned_to,
  assigneeName: row.assignee_name ?? null,
  createdBy: row.created_by,
  dueDate: row.due_date,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDateOnly = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);

export async function createTask({
  teamId,
  title,
  description,
  status,
  assignedTo,
  dueDate,
  createdBy,
}) {
  const { rows } = await query(
    `INSERT INTO tasks (team_id, title, description, status, assigned_to, due_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      teamId,
      title,
      description || null,
      status,
      assignedTo ?? null,
      toDateOnly(dueDate),
      createdBy,
    ],
  );
  return getTaskById(rows[0].id);
}

export async function getTaskById(taskId) {
  const { rows } = await query(`${TASK_SELECT} WHERE k.id = $1`, [taskId]);
  return rows[0] ? mapTask(rows[0]) : null;
}

/** Tasks are only visible to members of the task's team. */
export async function getTaskForUser(taskId, userId) {
  const { rows } = await query(
    `${TASK_SELECT}
      JOIN team_members me ON me.team_id = k.team_id AND me.user_id = $2
     WHERE k.id = $1`,
    [taskId, userId],
  );
  if (!rows[0]) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found or you do not have access to it.');
  }
  return mapTask(rows[0]);
}

export async function listTasks({ userId, teamId, assigneeId, status, q, limit = 50 }) {
  const { rows } = await query(
    `${TASK_SELECT}
      JOIN team_members me ON me.team_id = k.team_id AND me.user_id = $1
     WHERE ($2::int  IS NULL OR k.team_id = $2)
       AND ($3::int  IS NULL OR k.assigned_to = $3)
       AND ($4::text IS NULL OR k.status = $4)
       AND ($5::text IS NULL OR $5 = '' OR k.title ILIKE '%' || $5 || '%' OR k.description ILIKE '%' || $5 || '%')
     ORDER BY
       CASE k.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
       k.created_at DESC
     LIMIT $6`,
    [userId, teamId ?? null, assigneeId ?? null, status ?? null, q ?? '', limit],
  );
  return rows.map(mapTask);
}

/**
 * Open tasks assigned to the user that are due today or already overdue.
 * Dates come from the database so the grouping matches the SQL filter exactly.
 */
export async function listReminders(userId) {
  const [{ rows: dateRows }, { rows }] = await Promise.all([
    query('SELECT CURRENT_DATE::text AS today'),
    query(
      `${TASK_SELECT}
        JOIN team_members me ON me.team_id = k.team_id AND me.user_id = $1
       WHERE k.assigned_to = $1
         AND k.status <> 'done'
         AND k.due_date IS NOT NULL
         AND k.due_date <= CURRENT_DATE
       ORDER BY k.due_date ASC, k.created_at ASC`,
      [userId],
    ),
  ]);

  const today = dateRows[0].today;
  const reminders = rows.map(mapTask);

  return {
    today,
    overdue: reminders.filter((task) => task.dueDate < today),
    dueToday: reminders.filter((task) => task.dueDate === today),
  };
}

export async function updateTask(taskId, changes) {
  const columns = {
    title: 'title',
    description: 'description',
    status: 'status',
    assignedTo: 'assigned_to',
    dueDate: 'due_date',
  };

  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(columns)) {
    if (changes[key] === undefined) continue;

    let value = changes[key];
    if (key === 'dueDate') value = toDateOnly(value);
    if (key === 'description') value = value || null;

    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }

  sets.push('updated_at = now()');
  values.push(taskId);

  await query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  return getTaskById(taskId);
}

export async function deleteTask(taskId) {
  await query(`DELETE FROM tasks WHERE id = $1`, [taskId]);
}
