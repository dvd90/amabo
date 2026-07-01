/**
 * routes/demo.ts — the pre-signup birth moment (the funnel's front door). A logged-out
 * visitor meets an EPHEMERAL newborn Mote — condensed in the engine, voiced by the local
 * narrator — with no account and no DB row. The creature only becomes real (and persisted)
 * the moment they sign in and keep it, carrying this same `seed`. Public, stateless, cheap.
 */

import { condenseMote, needs } from '@amabo/engine';
import { CreatureView } from '@amabo/shared';
import { Router, type Request } from 'express';
import type { Clock, SeedSource } from '../clock.js';
import { birthThought } from '../narrate/local.js';
import { byIp, rateLimit } from '../rateLimit.js';

export interface DemoDeps {
  clock: Clock;
  seed: SeedSource;
}

// Generous for a curious visitor replaying the birth moment; a wall against scripted abuse.
const DEMO_MAX = 30;
const DEMO_WINDOW_MS = 60 * 1000;

export function demoRouter(deps: DemoDeps): Router {
  const { clock, seed } = deps;
  const router = Router();
  const limiter = rateLimit({ windowMs: DEMO_WINDOW_MS, max: DEMO_MAX, keyOf: byIp, clock });

  // A newborn Mote and its very first thought — never stored. The client may stash the
  // returned `seed` so the creature kept after signup is the one met here.
  router.get('/demo/birth', limiter, (_req: Request, res) => {
    const s = seed();
    const state = condenseMote(s, clock());
    const creature = CreatureView.parse({
      id: 'demo',
      name: 'Mote',
      state,
      graduatedAt: null,
      archivedAt: null,
      lastSeenAt: null,
      createdAt: clock(),
    });
    return res.json({ creature, needs: needs(state), thought: birthThought(s), seed: s });
  });

  return router;
}
