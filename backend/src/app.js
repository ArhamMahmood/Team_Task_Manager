import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import passport from './passport.js';
import { config } from './config.js';
import { query } from './db.js';
import { buildSessionMiddleware } from './session.js';
import { sameOriginOnly } from './middleware/origin.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../../frontend/dist');

export function createApp() {
  const app = express();

  // Cloud Run terminates TLS in front of the app.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Vite's dev server needs inline scripts; production uses the defaults.
      contentSecurityPolicy: config.isProd ? undefined : false,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(sameOriginOnly);

  app.use(buildSessionMiddleware());
  app.use(passport.initialize());
  app.use(passport.session());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
    },
  });

  app.get('/api/health', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded' });
    }
  });

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/users', userRoutes);

  app.use('/api', notFound);

  // In production the API also serves the built SPA (single origin, same cookies).
  if (config.serveStatic && fs.existsSync(distDir)) {
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }),
    );
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
