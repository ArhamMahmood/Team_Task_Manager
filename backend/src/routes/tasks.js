import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createTaskSchema,
  taskIdParam,
  taskQuerySchema,
  updateTaskSchema,
} from '../schemas/task.js';
import * as tasks from '../repos/tasks.js';
import { isMember, isOwner } from '../repos/teams.js';
import { AppError } from '../lib/AppError.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: taskQuerySchema }), async (req, res) => {
  const list = await tasks.listTasks({ userId: req.user.id, ...req.validated.query });
  res.json({ tasks: list });
});

router.post('/', validate({ body: createTaskSchema }), async (req, res) => {
  const body = req.validated.body;

  if (!(await isMember(body.teamId, req.user.id))) {
    throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found or you are not a member of it.');
  }
  await assertAssigneeIsMember(body.teamId, body.assignedTo);

  const task = await tasks.createTask({ ...body, createdBy: req.user.id });
  res.status(201).json({ task });
});

router.get('/:id', validate({ params: taskIdParam }), async (req, res) => {
  const task = await tasks.getTaskForUser(req.validated.params.id, req.user.id);
  res.json({ task });
});

router.patch('/:id', validate({ params: taskIdParam, body: updateTaskSchema }), async (req, res) => {
  const task = await tasks.getTaskForUser(req.validated.params.id, req.user.id);
  const changes = req.validated.body;

  if (changes.assignedTo !== undefined) {
    await assertAssigneeIsMember(task.teamId, changes.assignedTo);
  }

  const updated = await tasks.updateTask(task.id, changes);
  res.json({ task: updated });
});

router.delete('/:id', validate({ params: taskIdParam }), async (req, res) => {
  const task = await tasks.getTaskForUser(req.validated.params.id, req.user.id);
  const userIsTeamOwner = await isOwner(task.teamId, req.user.id);

  if (!userIsTeamOwner && task.createdBy !== req.user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the team owner or the task creator can delete this task.',
    );
  }

  await tasks.deleteTask(task.id);
  res.status(204).end();
});

async function assertAssigneeIsMember(teamId, assignedTo) {
  if (assignedTo === null || assignedTo === undefined) return;

  if (!(await isMember(teamId, assignedTo))) {
    throw new AppError(400, 'INVALID_ASSIGNEE', 'Tasks can only be assigned to members of the team.');
  }
}

export default router;
