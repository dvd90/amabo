/**
 * routes/creatures.ts — the six endpoints (ARCHITECTURE.md §7). Each handler:
 * zod-validate in → engine/ai → persist → zod-validate out. The clock and seed are
 * injected from the edge. Every lookup is owner-scoped via `getOwner(req)`; a missing
 * or cross-owner creature returns 404 (never 403 — don't leak existence).
 */

import { MAX_MEMORIES } from '@amabo/ai';
import { condenseMote, interact, summarizeGap, type InteractAction } from '@amabo/engine';
import {
  CreateCreatureRequest,
  CreatureView,
  InteractRequest,
  type CreatureViewT,
} from '@amabo/shared';
import { Router, type Request } from 'express';
import type { Clock, SeedSource } from '../clock.js';
import type { Narrator } from '../narrate/port.js';
import type { CreatureRecord, Repository } from '../repo/types.js';
import { catchUp } from '../service/catchup.js';

export interface CreatureDeps {
  repo: Repository;
  clock: Clock;
  seed: SeedSource;
  narrator: Narrator;
  /** Resolves the owner for a request. v1 returns null; M5.5 returns the session user. */
  getOwner: (req: Request) => string | null;
}

function toView(rec: CreatureRecord): CreatureViewT {
  return CreatureView.parse({
    id: rec.id,
    name: rec.name,
    state: rec.state,
    graduatedAt: rec.graduatedAt,
    createdAt: rec.createdAt,
  });
}

const asyncHandler =
  <T>(fn: (req: Request, res: import('express').Response) => Promise<T>) =>
  (req: Request, res: import('express').Response, next: import('express').NextFunction) =>
    fn(req, res).catch(next);

export function creaturesRouter(deps: CreatureDeps): Router {
  const { repo, clock, seed, narrator, getOwner } = deps;
  const router = Router();

  // The dashboard: all of the signed-in Light's creatures (caught up to now).
  router.get(
    '/creatures',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const recs = await repo.listCreaturesByOwner(owner);
      const now = clock();
      const views: CreatureViewT[] = [];
      for (const rec of recs) {
        const { record } = await catchUp(repo, rec, now);
        views.push(toView(record));
      }
      return res.json({ creatures: views });
    }),
  );

  // Condense a Mote.
  router.post(
    '/creatures',
    asyncHandler(async (req, res) => {
      const parsed = CreateCreatureRequest.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const rec = await repo.createCreature({
        ownerId: getOwner(req),
        name: parsed.data.name,
        state: condenseMote(seed(), clock()),
      });
      return res.status(201).json(toView(rec));
    }),
  );

  // Catch-up read.
  router.get(
    '/creatures/:id',
    asyncHandler(async (req, res) => {
      const rec = await repo.getCreature(req.params.id!, getOwner(req));
      if (!rec) return res.status(404).json({ error: 'not found' });
      const { record } = await catchUp(repo, rec, clock());
      return res.json(toView(record));
    }),
  );

  // Catch-up + narrate the gap.
  router.post(
    '/creatures/:id/peek',
    asyncHandler(async (req, res) => {
      const rec = await repo.getCreature(req.params.id!, getOwner(req));
      if (!rec) return res.status(404).json({ error: 'not found' });
      const now = clock();
      // Capture the gap BEFORE catch-up overwrites lastTickAt, for the away-recap.
      const elapsedMs = now - rec.state.lastTickAt;
      const before = rec.state;
      const { record, events, graduated } = await catchUp(repo, rec, now);
      const away = summarizeGap(before, record.state, events, elapsedMs);
      const mode = events.some((e) => e.salience >= 4) ? 'milestone' : 'peek';
      // Only the top-N memories by salience are sent — keeps the prompt flat (M7).
      const memories = await repo.topMemories(record.id, MAX_MEMORIES);
      const narration = await narrator.narrate(
        { name: record.name, state: record.state, memories },
        events,
        mode,
      );
      if (narration.newMemories && narration.newMemories.length > 0) {
        await repo.addMemories(
          record.id,
          narration.newMemories.map((m) => ({ at: clock(), text: m.text, salience: m.salience })),
        );
      }
      return res.json({ ...narration, creature: toView(record), graduated, away });
    }),
  );

  // Care.
  router.post(
    '/creatures/:id/interact',
    asyncHandler(async (req, res) => {
      const parsed = InteractRequest.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const rec = await repo.getCreature(req.params.id!, getOwner(req));
      if (!rec) return res.status(404).json({ error: 'not found' });

      const now = clock();
      const { record } = await catchUp(repo, rec, now);
      if (record.graduatedAt !== null) {
        return res.status(409).json({ error: 'this creature has graduated' });
      }
      const action = parsed.data.action as InteractAction;
      const { state, events } = interact(record.state, action);
      const updated: CreatureRecord = { ...record, state };
      await repo.saveCreature(updated);
      await repo.appendEvents(updated.id, events, 'user');
      await repo.recordInteraction(updated.id, action, now);
      return res.json({ creature: toView(updated), events });
    }),
  );

  // Journal feed (paginated).
  router.get(
    '/creatures/:id/journal',
    asyncHandler(async (req, res) => {
      const rec = await repo.getCreature(req.params.id!, getOwner(req));
      if (!rec) return res.status(404).json({ error: 'not found' });
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);
      const entries = await repo.listJournal(rec.id, limit, offset);
      return res.json({ entries });
    }),
  );

  // The constellation of graduated souls.
  router.get(
    '/creatures/:id/stars',
    asyncHandler(async (req, res) => {
      // Stars are owner-scoped; the :id keeps the URL shape per ARCHITECTURE §7.
      const owner = getOwner(req);
      const rec = await repo.getCreature(req.params.id!, owner);
      if (!rec) return res.status(404).json({ error: 'not found' });
      const stars = await repo.listStars(owner);
      return res.json({ stars });
    }),
  );

  return router;
}
