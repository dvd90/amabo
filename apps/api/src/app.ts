/**
 * app.ts — assemble the Express app from injected dependencies (so tests can pass an
 * in-memory repo, a mocked clock, a deterministic seed, and a fake OAuth provider).
 *
 * Pipeline: attach the session → public auth routes → require auth + CSRF → the
 * owner-scoped creature routes. Owner is always the session user (ARCHITECTURE.md §14).
 */

import express, { type ErrorRequestHandler, type Express } from 'express';
import path from 'node:path';
import type { Clock, SeedSource } from './clock.js';
import type { AuthProvider } from './auth/provider.js';
import { attachUser, requireAuth, requireCsrf } from './auth/middleware.js';
import { consoleMailer, type Mailer } from './auth/mailer.js';
import { cors } from './cors.js';
import type { SameSite } from './auth/session.js';
import { nullMonitor, type Monitor } from './monitor.js';
import type { Narrator } from './narrate/port.js';
import type { Repository } from './repo/types.js';
import { authRouter } from './routes/auth.js';
import { creaturesRouter } from './routes/creatures.js';
import { pushRouter } from './routes/push.js';
import { authedShareRouter, publicShareRouter } from './routes/share.js';
import { demoRouter } from './routes/demo.js';
import { symposiumRouter } from './routes/symposium.js';
import { telemetryRouter } from './routes/telemetry.js';
import { localSymposiumNarrator, type SymposiumNarrator } from './narrate/symposium.js';

export interface AppDeps {
  repo: Repository;
  clock: Clock;
  seed: SeedSource;
  narrator: Narrator;
  authProvider: AuthProvider;
  cookieSecure: boolean;
  baseUrl: string;
  /** If set, serve the built PWA from this dir (single-origin deploy). Omitted = API only. */
  staticDir?: string;
  /** Two-service deploy: the web origin to allow via CORS + redirect to after login. */
  webOrigin?: string;
  /** True when real Google OAuth credentials are configured (drives the login UI). */
  googleEnabled?: boolean;
  /** Pin the exact OAuth redirect URI (GOOGLE_CALLBACK_URL); derived from the request if unset. */
  googleCallbackUrl?: string;
  /** VAPID public key for web-push; served to the client so it can subscribe. */
  vapidPublicKey?: string;
  /** Sends the magic-link email (defaults to logging the link to the console). */
  mailer?: Mailer;
  /** HMAC secret for magic-link tokens (AUTH_SECRET). A dev default is used if unset. */
  magicSecret?: string;
  /** Echo the magic link in the POST response — local dev only; never in production. */
  magicDevEcho?: boolean;
  /** Voices a Symposium gathering (defaults to the local templated narrator). */
  symposiumNarrator?: SymposiumNarrator;
  /** The build this process runs (git SHA on Railway); "dev" locally. See /health. */
  version?: string;
  /** Error eyes (L1): captures 500s + client_error beats. Defaults to a no-op. */
  monitor?: Monitor;
}

/** URL prefixes owned by the API — everything else is a client (SPA) route. */
const API_PREFIXES = [
  '/health',
  '/telemetry',
  '/me',
  '/auth',
  '/creatures',
  '/visit',
  '/postcard',
  '/share',
  '/rehome',
  '/rehomes',
  '/meet',
  '/report',
  '/block',
  '/push',
  '/symposium',
];
const isApiPath = (p: string) => API_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'));

export function createApp(deps: AppDeps): Express {
  const app = express();
  // Behind Railway's TLS proxy, trust X-Forwarded-* so Secure cookies behave.
  if (deps.cookieSecure) app.set('trust proxy', 1);
  // Credentialed CORS only matters in the two-service deploy (a web origin is set).
  app.use(cors(deps.webOrigin));
  app.use(express.json());

  // Cross-site cookies require SameSite=None (+ Secure); same-origin uses Lax.
  const sameSite: SameSite = deps.webOrigin ? 'none' : 'lax';

  // Deploy truth (LAUNCH_PLAN.md L0): /health names the exact build, so "is X live?"
  // is answered by comparing `version` to `git rev-parse origin/main`.
  const startedAt = deps.clock();
  app.get('/health', (_req, res) => {
    res.json({ ok: true, version: deps.version ?? 'dev', startedAt });
  });

  // Public: the VAPID key the client needs to subscribe to push (no secrets here).
  app.get('/push/vapid', (_req, res) => {
    res.json({ key: deps.vapidPublicKey ?? null });
  });

  const monitor = deps.monitor ?? nullMonitor;

  // Session attachment + public auth lifecycle.
  app.use(attachUser(deps.repo, deps.clock));
  // The funnel's ear (L1): public, rate-limited, allowlisted. After attachUser so a
  // signed-in beat carries its Light; before the auth gate so a visitor counts too.
  app.use(telemetryRouter({ repo: deps.repo, clock: deps.clock, monitor }));
  app.use(
    authRouter({
      repo: deps.repo,
      authProvider: deps.authProvider,
      clock: deps.clock,
      cookieSecure: deps.cookieSecure,
      sameSite,
      baseUrl: deps.baseUrl,
      postLoginRedirect: deps.webOrigin ?? '/',
      googleEnabled: deps.googleEnabled ?? false,
      callbackOverride: deps.googleCallbackUrl,
      mailer: deps.mailer ?? consoleMailer,
      magicSecret: deps.magicSecret ?? 'amabo-dev-magic-secret',
      // Default on for local/test convenience; index.ts forces it false in production.
      magicDevEcho: deps.magicDevEcho ?? true,
    }),
  );

  const getOwner = (req: import('express').Request) => req.user?.id ?? null;

  // Public capability-token reads (visits warm the creature; postcards are read-only).
  // Mounted BEFORE the auth gate so another Light can shine in without an account.
  app.use(
    publicShareRouter({ repo: deps.repo, clock: deps.clock, baseUrl: deps.baseUrl, getOwner }),
  );

  // The pre-signup birth moment: a logged-out visitor meets an ephemeral newborn Mote.
  app.use(demoRouter({ clock: deps.clock, seed: deps.seed }));

  // Single-origin deploy: serve the built PWA + SPA fallback for non-API GETs, BEFORE
  // the auth gate (so visiting `/sky` etc. returns the app, not a 401).
  if (deps.staticDir) {
    const dir = deps.staticDir;
    app.use(express.static(dir));
    app.get(/.*/, (req, res, next) => {
      if (req.method !== 'GET' || isApiPath(req.path)) return next();
      return res.sendFile(path.join(dir, 'index.html'));
    });
  }

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
    authedShareRouter({
      repo: deps.repo,
      clock: deps.clock,
      baseUrl: deps.baseUrl,
      webOrigin: deps.webOrigin,
      getOwner,
    }),
  );
  app.use(pushRouter({ repo: deps.repo, getOwner }));
  app.use(
    symposiumRouter({
      repo: deps.repo,
      clock: deps.clock,
      narrator: deps.symposiumNarrator ?? localSymposiumNarrator,
      getOwner,
    }),
  );

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    monitor.capture(err, { method: req.method, path: req.path });
    res.status(500).json({ error: 'internal error' });
  };
  app.use(onError);

  return app;
}
