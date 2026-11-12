import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { Deps } from './core/types.js';
import { ApiError, errorHandler } from './core/errors.js';
import { endpoint } from './core/http.js';
import { authenticate, authRouter, profileRouter } from './auth/index.js';
import { financeRouter } from './finance/index.js';
import { analyticsRouter } from './analytics/index.js';
import { makeOpenApi } from './openapi.js';
export function createApp(deps: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () =>
      deps.logger.info({
        event: 'request',
        requestId: req.requestId,
        method: req.method,
        status: res.statusCode,
      }),
    );
    next();
  });
  app.use(helmet());
  const limited = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
          requestId: req.requestId,
        }),
    });
  if (deps.config.env !== 'test') app.use(limited(1000));
  app.use(express.json({ limit: '64kb', strict: true }));
  app.get('/health/live', (_req, res) => res.json({ data: { status: 'ok' } }));
  app.get(
    '/health/ready',
    endpoint(async (req, res) => {
      try {
        await deps.db.$queryRaw`SELECT 1`;
        res.json({ data: { status: 'ready' } });
      } catch {
        res.status(503).json({
          error: { code: 'NOT_READY', message: 'Service unavailable.' },
          requestId: req.requestId,
        });
      }
    }),
  );
  app.get('/openapi.json', (_req, res) => res.json(makeOpenApi()));
  if (deps.config.env !== 'test') app.use('/api/v1/auth', limited(30));
  app.use('/api/v1/auth', authRouter(deps));
  app.use('/api/v1', authenticate(deps));
  app.use('/api/v1', profileRouter(deps), financeRouter(deps), analyticsRouter(deps));
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));
  app.use(errorHandler(deps));
  return app;
}
