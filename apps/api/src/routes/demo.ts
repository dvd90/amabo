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

export interface DemoDeps {
  clock: Clock;
  seed: SeedSource;
}

export function demoRouter(deps: DemoDeps): Router {
  const { clock, seed } = deps;
  const router = Router();

  // A newborn Mote and its very first thought — never stored. The client may stash the
  // returned `seed` so the creature kept after signup is the one met here.
  router.get('/demo/birth', (_req: Request, res) => {
    const s = seed();
    const state = condenseMote(s, clock());
    const creature = CreatureView.parse({
      id: 'demo',
      name: 'Mote',
      state,
      graduatedAt: null,
      lastSeenAt: null,
      createdAt: clock(),
    });
    return res.json({ creature, needs: needs(state), thought: birthThought(s), seed: s });
  });

  return router;
}
