/**
 * routes/creatures.ts — the six endpoints (ARCHITECTURE.md §7). Each handler:
 * zod-validate in → engine/ai → persist → zod-validate out. The clock and seed are
 * injected from the edge. Every lookup is owner-scoped via `getOwner(req)`; a missing
 * or cross-owner creature returns 404 (never 403 — don't leak existence).
 */

import { MAX_MEMORIES } from '@amabo/ai';
import {
  canMultiply,
  condenseMote,
  interact,
  multiply,
  needs,
  summarizeGap,
  type InteractAction,
  type NeedFlag,
} from '@amabo/engine';
import {
  CreateCreatureRequest,
  CreatureView,
  InteractRequest,
  type CreatureViewT,
  SLOTS,
} from '@amabo/shared';
import { Router, type Request } from 'express';
import type { Clock, SeedSource } from '../clock.js';
import type { Narrator } from '../narrate/port.js';
import type { CreatureRecord, Repository } from '../repo/types.js';
import { byIp, rateLimit } from '../rateLimit.js';
import { catchUp } from '../service/catchup.js';

/** Key a limiter by the signed-in Light (these routes all sit behind requireAuth). */
const byOwner =
  (getOwner: (req: Request) => string | null) =>
  (req: Request): string =>
    getOwner(req) ?? byIp(req);

// Generous for any real session (nobody condenses a dozen Motes a session), a wall
// against scripted account/DB flooding.
const CREATE_MAX = 10;
const CREATE_WINDOW_MS = 60 * 60 * 1000;
// Matches the client's own peek debounce (PEEK_DEBOUNCE_MS), now also enforced
// server-side — the real ceiling on AI spend once narration is model-backed.
const PEEK_MAX = 30;
const PEEK_WINDOW_MS = 60 * 60 * 1000;

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
    archivedAt: rec.archivedAt,
    lastSeenAt: rec.lastSeenAt,
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
  const createLimiter = rateLimit({
    windowMs: CREATE_WINDOW_MS,
    max: CREATE_MAX,
    keyOf: byOwner(getOwner),
    clock,
    message: 'too many new amabos at once — slow down and try again shortly',
  });
  const peekLimiter = rateLimit({
    windowMs: PEEK_WINDOW_MS,
    max: PEEK_MAX,
    keyOf: byOwner(getOwner),
    clock,
    message: 'too many peeks at once — slow down and try again shortly',
  });

  // The dashboard: all of the signed-in Light's creatures (caught up to now).
  router.get(
    '/creatures',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const recs = await repo.listCreaturesByOwner(owner);
      const now = clock();
      const creatures: (CreatureViewT & { needs: NeedFlag[] })[] = [];
      for (const rec of recs) {
        const { record } = await catchUp(repo, rec, now);
        creatures.push({ ...toView(record), needs: needs(record.state) });
      }
      return res.json({ creatures });
    }),
  );

  /** The shelf's width for this Light: the till widens it, never the soul (L5). */
  const shelfFor = (req: import('express').Request): number =>
    req.user?.entitlements.tier === 'lantern' ? SLOTS.lantern : SLOTS.free;

  /** Living, present lights only — the shelf never counts the ascended or archived. */
  const activeCount = async (owner: string | null): Promise<number> => {
    const all = await repo.listCreaturesByOwner(owner);
    return all.filter((c) => c.state.alive && c.graduatedAt === null && c.archivedAt === null)
      .length;
  };

  // Condense a Mote.
  router.post(
    '/creatures',
    createLimiter,
    asyncHandler(async (req, res) => {
      // The age gate (L2): no stated band, no creatures — 13+ and meant.
      if ((req.user?.ageBand ?? null) === null) {
        return res.status(403).json({ error: 'age confirmation required' });
      }
      // The shelf (L4/L5): capacity per tier, kindly enforced. Endings never count.
      const cap = shelfFor(req);
      if ((await activeCount(getOwner(req))) >= cap) {
        return res.status(403).json({
          error:
            cap === SLOTS.free
              ? `your shelf holds ${SLOTS.free} — the Keeper's Lantern widens it ✦`
              : `your shelf holds ${cap} lights — lay one to rest to make room ✦`,
        });
      }
      const parsed = CreateCreatureRequest.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const now = clock();
      const rec = await repo.createCreature({
        ownerId: getOwner(req),
        name: parsed.data.name,
        // Honour the seed of the Mote met at the door, if the client passed one (§ funnel).
        state: condenseMote(parsed.data.seed ?? seed(), now),
      });
      // Condensing it is the first look-in, so the away-gap starts from now (not null).
      await repo.markSeen(rec.id, now);
      rec.lastSeenAt = now;
      await repo.addTelemetry([
        { name: 'creature_created', anonId: null, userId: getOwner(req), at: now, props: null },
      ]);
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
      return res.json({ ...toView(record), needs: needs(record.state) });
    }),
  );

  // Catch-up + narrate the gap.
  router.post(
    '/creatures/:id/peek',
    peekLimiter,
    asyncHandler(async (req, res) => {
      const rec = await repo.getCreature(req.params.id!, getOwner(req));
      if (!rec) return res.status(404).json({ error: 'not found' });
      const now = clock();
      // The away-gap is measured from the last explicit LOOK-IN (lastSeenAt), not
      // lastTickAt — background/dashboard catch-up advances lastTickAt to "now", which
      // would otherwise make every open read as ~0 ("a moment in the dark").
      const prevSeen = rec.lastSeenAt;
      const before = rec.state;
      const { record, events, graduated } = await catchUp(repo, rec, now);
      // Record this as an explicit "look in" so the roster can show "Xh ago".
      await repo.markSeen(rec.id, now);
      record.lastSeenAt = now;
      await repo.addTelemetry([
        { name: 'peek', anonId: null, userId: getOwner(req), at: now, props: null },
      ]);
      const elapsedMs = prevSeen == null ? 0 : now - prevSeen;
      const away = summarizeGap(before, record.state, events, elapsedMs);
      const mode = events.some((e) => e.salience >= 4) ? 'milestone' : 'peek';
      // Only the top-N memories by salience are sent — keeps the prompt flat (M7).
      const memories = await repo.topMemories(record.id, MAX_MEMORIES);
      const narration = await narrator.narrate(
        { name: record.name, state: record.state, memories, ownerId: getOwner(req) },
        events,
        mode,
      );
      if (narration.newMemories && narration.newMemories.length > 0) {
        await repo.addMemories(
          record.id,
          narration.newMemories.map((m) => ({ at: clock(), text: m.text, salience: m.salience })),
        );
      }
      return res.json({
        ...narration,
        creature: toView(record),
        graduated,
        away,
        needs: needs(record.state),
      });
    }),
  );

  // Lay an ENDED light to rest (STORY.md §7 "Endings leave the shelf"): only an
  // ascended (graduated) or faded (light gone out) creature can be archived — the
  // ceremony's confirm calls this. A living creature answers 409; never a deletion.
  router.post(
    '/creatures/:id/archive',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const rec = await repo.getCreature(req.params.id!, owner);
      if (!rec) return res.status(404).json({ error: 'not found' });
      const ended = rec.graduatedAt !== null || !rec.state.alive;
      if (!ended) {
        return res.status(409).json({ error: 'only an ended light can be laid to rest' });
      }
      await repo.archiveCreature(rec.id, owner, clock());
      return res.json({ archived: true });
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
      await repo.addTelemetry([
        { name: 'care_action', anonId: null, userId: getOwner(req), at: now, props: { action } },
      ]);
      return res.json({ creature: toView(updated), events, needs: needs(updated.state) });
    }),
  );

  // The Symposium split — a creature overflowing with Ambra shares its light (M-F).
  router.post(
    '/creatures/:id/multiply',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const rec = await repo.getCreature(req.params.id!, owner);
      if (!rec) return res.status(404).json({ error: 'not found' });
      const now = clock();
      const { record } = await catchUp(repo, rec, now);
      if (!canMultiply(record.state)) {
        return res.status(409).json({ error: 'not overflowing yet' });
      }
      // The split needs room too (L4) — overflow keeps; it simply waits for a shelf.
      if ((await activeCount(owner)) >= shelfFor(req)) {
        return res
          .status(403)
          .json({ error: 'no room on the shelf — lay a light to rest, or widen it one day ✦' });
      }
      const { parent, child } = multiply(record.state);
      const updatedParent: CreatureRecord = { ...record, state: parent };
      await repo.saveCreature(updatedParent);
      const childRec = await repo.createCreature({
        ownerId: owner,
        name: `${record.name}'s half`,
        state: child,
      });
      await repo.markSeen(childRec.id, now);
      childRec.lastSeenAt = now;
      return res.status(201).json({
        parent: { ...toView(updatedParent), needs: needs(updatedParent.state) },
        child: { ...toView(childRec), needs: needs(childRec.state) },
      });
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
