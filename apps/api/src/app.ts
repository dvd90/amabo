/**
 * app.ts — assemble the Express app from injected dependencies (so tests can pass an
 * in-memory repo, a mocked clock, and a deterministic seed). No globals, no I/O here.
 */

import express, { type ErrorRequestHandler, type Express } from 'express';
import { creaturesRouter, type CreatureDeps } from './routes/creatures.js';

export function createApp(deps: CreatureDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(creaturesRouter(deps));

  const onError: ErrorRequestHandler = (_err, _req, res, _next) => {
    res.status(500).json({ error: 'internal error' });
  };
  app.use(onError);

  return app;
}
