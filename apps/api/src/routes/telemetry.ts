/**
 * routes/telemetry.ts — the funnel's ear (LAUNCH_PLAN.md L1). One public, rate-limited
 * endpoint the web app fires small named beats at; rows land in our own Postgres
 * (`telemetry`), no third party, no cookies beyond the session that may already exist.
 * Names are allowlisted so this can never become a free-form data hose, and a
 * `client_error` beat is forwarded to the monitor — one Sentry, both apps.
 */

import { Router, type Request } from 'express';
import type { Clock } from '../clock.js';
import type { Monitor } from '../monitor.js';
import { byIp, rateLimit } from '../rateLimit.js';
import type { Repository } from '../repo/types.js';

/** Every beat the funnel understands — FUNNEL.sql queries exactly these. */
export const TELEMETRY_NAMES = new Set([
  'visit',
  'birth_seen',
  'signup',
  'creature_created',
  'care_action',
  'peek',
  'narration',
  'push_enabled',
  'client_error',
]);

const MAX_BATCH = 20;
const MAX_PROPS_JSON = 2048;

export function telemetryRouter(deps: {
  repo: Repository;
  clock: Clock;
  monitor: Monitor;
}): Router {
  const { repo, clock, monitor } = deps;
  const router = Router();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 120,
    keyOf: byIp,
    clock,
    message: 'too many signals',
  });

  router.post('/telemetry', limiter, (req: Request, res, next) => {
    void (async () => {
      try {
        const anonId = typeof req.body?.anonId === 'string' ? req.body.anonId.slice(0, 64) : null;
        const events: unknown = req.body?.events;
        if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) {
          return res.status(400).json({ error: 'events must be a batch of 1–20' });
        }
        const rows = [];
        for (const e of events as { name?: unknown; props?: unknown }[]) {
          if (typeof e?.name !== 'string' || !TELEMETRY_NAMES.has(e.name)) {
            return res.status(400).json({ error: 'unknown event name' });
          }
          let props: Record<string, unknown> | null = null;
          if (e.props && typeof e.props === 'object' && !Array.isArray(e.props)) {
            const json = JSON.stringify(e.props);
            if (json.length <= MAX_PROPS_JSON) props = e.props as Record<string, unknown>;
          }
          if (e.name === 'client_error') {
            const msg = String((props as { message?: unknown } | null)?.message ?? 'client error');
            monitor.capture(new Error(`[client] ${msg}`), props ?? undefined);
          }
          rows.push({ name: e.name, anonId, userId: req.user?.id ?? null, at: clock(), props });
        }
        await repo.addTelemetry(rows);
        return res.status(204).end();
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
