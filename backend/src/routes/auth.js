import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { createUser, findUserByEmail } from '../repos/users.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/AppError.js';

const router = Router();

router.post('/register', validate({ body: registerSchema }), async (req, res) => {
  const { name, email, password } = req.validated.body;

  if (await findUserByEmail(email)) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  let user;
  try {
    user = await createUser({ name, email, passwordHash });
  } catch (err) {
    // Unique violation - covers the race between the check above and the insert.
    if (err.code === '23505') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }

  await establishSession(req, user);
  res.status(201).json({ user });
});

router.post('/login', validate({ body: loginSchema }), (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return next(new AppError(401, 'INVALID_CREDENTIALS', info?.message ?? 'Invalid email or password.'));
    }

    establishSession(req, user)
      .then(() => res.json({ user }))
      .catch(next);
  })(req, res, next);
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie(config.cookieName);
      res.status(204).end();
    });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** Regenerate the session id on login/registration to prevent session fixation. */
function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.login(user, (loginErr) => (loginErr ? reject(loginErr) : resolve()));
    });
  });
}

export default router;
