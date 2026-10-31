import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addMemberSchema,
  createTeamSchema,
  teamIdParam,
  teamMemberParam,
  updateTeamSchema,
} from '../schemas/team.js';
import * as teams from '../repos/teams.js';
import { findUserByEmail } from '../repos/users.js';
import { AppError } from '../lib/AppError.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  res.json({ teams: await teams.listTeamsForUser(req.user.id) });
});

router.post('/', validate({ body: createTeamSchema }), async (req, res) => {
  const team = await teams.createTeam({ ...req.validated.body, createdBy: req.user.id });
  res.status(201).json({ team });
});

router.get('/:id', validate({ params: teamIdParam }), async (req, res) => {
  const team = await teams.getTeamForUser(req.validated.params.id, req.user.id);
  res.json({ team });
});

router.patch('/:id', validate({ params: teamIdParam, body: updateTeamSchema }), async (req, res) => {
  const team = await teams.updateTeam(req.validated.params.id, req.user.id, req.validated.body);
  res.json({ team });
});

router.delete('/:id', validate({ params: teamIdParam }), async (req, res) => {
  await teams.deleteTeam(req.validated.params.id, req.user.id);
  res.status(204).end();
});

router.get('/:id/members', validate({ params: teamIdParam }), async (req, res) => {
  const teamId = req.validated.params.id;
  await teams.getTeamForUser(teamId, req.user.id); // membership check
  res.json({ members: await teams.listMembers(teamId) });
});

router.post('/:id/members', validate({ params: teamIdParam, body: addMemberSchema }), async (req, res) => {
  const teamId = req.validated.params.id;
  const team = await teams.getTeamForUser(teamId, req.user.id);

  if (team.createdBy !== req.user.id) {
    throw new AppError(403, 'FORBIDDEN', 'Only the team owner can add members.');
  }

  const user = await findUserByEmail(req.validated.body.email);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'No account exists with that email.');
  }

  await teams.addMember(teamId, user.id);
  res.status(201).json({ member: { id: user.id, name: user.name, email: user.email } });
});

router.delete('/:id/members/:userId', validate({ params: teamMemberParam }), async (req, res) => {
  const { id: teamId, userId } = req.validated.params;
  const team = await teams.getTeamForUser(teamId, req.user.id);

  if (team.createdBy !== req.user.id) {
    throw new AppError(403, 'FORBIDDEN', 'Only the team owner can remove members.');
  }
  if (userId === req.user.id) {
    throw new AppError(400, 'CANNOT_REMOVE_OWNER', 'The team owner cannot be removed from the team.');
  }

  await teams.removeMember(teamId, userId);
  res.status(204).end();
});

export default router;
