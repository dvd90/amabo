/**
 * @amabo/api — Express endpoints, persistence, and the engine host
 * (docs/ARCHITECTURE.md §7).
 *
 * The wall clock is injected HERE, at the edge — never inside packages/engine.
 * Handlers will zod-validate in → call engine/ai → persist → zod-validate out, and
 * every creature query will be owner-scoped once auth lands at M5.5. M0 is just a
 * compiling placeholder with a health check.
 */

import express, { type Express } from 'express';

/** A clock the engine never sees; the API supplies `now` at the boundary. */
export type Clock = () => number;
export const systemClock: Clock = () => Date.now();

export function createApp(clock: Clock = systemClock): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, now: clock() });
  });

  return app;
}

// Only listen when run directly, not when imported by tests.
if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`amabo api listening on :${port}`);
  });
}
