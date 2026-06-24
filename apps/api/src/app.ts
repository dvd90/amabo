/**
 * app.ts — assemble the Express app from injected dependencies (so tests can pass an
 * in-memory repo, a mocked clock, a deterministic seed, and a fake OAuth provider).
 *
 * Pipeline: attach the session → public auth routes → require auth + CSRF → the
 * owner-scoped creature routes. Owner is always the session user (ARCHITECTURE.md §14).
 */

import express, { type ErrorRequestHandler, type Express } from 'express';
import type { Clock, SeedSource } from './clock.js';
import type { AuthProvider } from './auth/provider.js';
import { attachUser, requireAuth, requireCsrf } from './auth/middleware.js';
import type { Narrator } from './narrate/port.js';
import type { Repository } from './repo/types.js';
import { authRouter } from './routes/auth.js';
import { creaturesRouter } from './routes/creatures.js';
import { authedShareRouter, publicShareRouter } from './routes/share.js';

export interface AppDeps {
  repo: Repository;
  clock: Clock;
  seed: SeedSource;
  narrator: Narrator;
  authProvider: AuthProvider;
  cookieSecure: boolean;
  baseUrl: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Session attachment + public auth lifecycle.
  app.use(attachUser(deps.repo, deps.clock));
  app.use(
    authRouter({
      repo: deps.repo,
      authProvider: deps.authProvider,
      clock: deps.clock,
      cookieSecure: deps.cookieSecure,
      baseUrl: deps.baseUrl,
    }),
  );

  const getOwner = (req: import('express').Request) => req.user?.id ?? null;

  // Public capability-token reads (visits warm the creature; postcards are read-only).
  // Mounted BEFORE the auth gate so another Light can shine in without an account.
  app.use(
    publicShareRouter({ repo: deps.repo, clock: deps.clock, baseUrl: deps.baseUrl, getOwner }),
  );

  // Everything below requires a session; mutations require a valid CSRF token.
  app.use(requireAuth);
  app.use(requireCsrf);
  app.use(
    creaturesRouter({
      repo: deps.repo,
      clock: deps.clock,
      seed: deps.seed,
      narrator: deps.narrator,
      getOwner,
    }),
  );
  app.use(
    authedShareRouter({ repo: deps.repo, clock: deps.clock, baseUrl: deps.baseUrl, getOwner }),
  );

  const onError: ErrorRequestHandler = (_err, _req, res, _next) => {
    res.status(500).json({ error: 'internal error' });
  };
  app.use(onError);

  return app;
}
