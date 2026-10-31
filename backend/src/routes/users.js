import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { searchUsers } from '../repos/users.js';

const router = Router();

const searchSchema = Joi.object({
  search: Joi.string().trim().max(100).allow('').default(''),
});

router.get('/', requireAuth, validate({ query: searchSchema }), async (req, res) => {
  const users = await searchUsers(req.validated.query.search, req.user.id, 10);
  res.json({ users });
});

export default router;
