/**
 * routes/chronicle.ts — the shelf's own book (STORY.md §8⅞). One owner-scoped read:
 * GET /chronicle rolls what happened among the company since the last page (the
 * ENGINE decides who met and how it went from tempers and chance; the chronicler —
 * AI or local — only writes it), persists the new pages + refreshed standings +
 * bond threads, and returns the book, most recent first.
 *
 * Story, not fate, at the boundary too: nothing here writes a creature's state.
 * The read is self-limiting — a gap shorter than CHRONICLE.minGapMs rolls nothing,
 * so refreshing the page costs no model calls.
 */

import { localChronicle, type ChronicleResult, type ChronicleSceneInput } from '@amabo/ai';
import { CHRONICLE, bondDeltaFor, deriveSeed, mulberry32, rollEncounters } from '@amabo/engine';
import { Router, type Request } from 'express';
import type { Clock } from '../clock.js';
import type { Repository } from '../repo/types.js';

const LOOKBACK_CAP_MS = 8 * CHRONICLE.minGapMs; // a first read chronicles at most ~2 days
const PAGE_LIMIT = 50;

export interface ChronicleDeps {
  repo: Repository;
  clock: Clock;
  getOwner: (req: Request) => string | null;
  /** Writes the book (AI in prod, seeded local by default) — never trusted upstream. */
  chronicler?: (
    input: ChronicleSceneInput & { ownerId: string | null },
  ) => Promise<ChronicleResult>;
}

const asyncHandler =
  <T>(fn: (req: Request, res: import('express').Response) => Promise<T>) =>
  (req: Request, res: import('express').Response, next: import('express').NextFunction) =>
    fn(req, res).catch(next);

export function chronicleRouter(deps: ChronicleDeps): Router {
  const { repo, clock, getOwner } = deps;
  const chronicler = deps.chronicler ?? (async (input) => localChronicle(input));
  const router = Router();

  router.get(
    '/chronicle',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const now = clock();

      const all = await repo.listCreaturesByOwner(owner);
      const active = all.filter(
        (c) => c.state.alive && c.graduatedAt === null && c.archivedAt === null,
      );
      const nameOf = new Map(all.map((c) => [c.id, c.name]));

      if (active.length >= 2) {
        // Roll from the last page (or a capped lookback on the first read).
        const last = await repo.lastChronicleAt(owner);
        const since = last ?? now - LOOKBACK_CAP_MS;
        const elapsed = Math.min(Math.max(now - since, 0), LOOKBACK_CAP_MS);

        // Deterministic per shelf per moment: the members' seeds salt the roll.
        const seedSum = active.reduce((sum, c) => (sum + c.state.seed) >>> 0, 0);
        const rng = mulberry32(deriveSeed(seedSum, Math.floor(now / 1000)));
        const outlines = rollEncounters(
          active.map((c) => ({ id: c.id, state: c.state })),
          elapsed,
          rng,
        );

        if (outlines.length > 0) {
          const encounters = await Promise.all(
            outlines.map(async (o) => {
              const a = active.find((c) => c.id === o.aId)!;
              const b = active.find((c) => c.id === o.bId)!;
              const prior = await repo.getStanding(owner, o.aId, o.bId);
              return {
                aName: a.name,
                bName: b.name,
                valence: o.valence,
                tag: o.tag,
                aSoulmark: a.persona?.essence ?? null,
                bSoulmark: b.persona?.essence ?? null,
                standing: prior?.line ?? null,
              };
            }),
          );

          // The chronicler writes; anything it says was already validated/clamped
          // downstream, and the local book stands in on any failure.
          const book = await chronicler({ encounters, ownerId: owner });

          await repo.addChronicleEntries(
            outlines.map((o, i) => ({
              ownerId: owner,
              at: now,
              aId: o.aId,
              bId: o.bId,
              valence: o.valence,
              tag: o.tag,
              text: book.entries[i]?.text ?? '',
            })),
          );
          for (let i = 0; i < outlines.length; i++) {
            const o = outlines[i]!;
            const line = book.entries[i]?.standing;
            if (line) await repo.upsertStanding(owner, o.aId, o.bId, o.valence, line, now);
          }
          // Every meeting hangs a thread in the friendship sky — smaller for a strain.
          await repo.recordBonds(
            owner,
            outlines.map((o) => ({ a: o.aId, b: o.bId, strength: bondDeltaFor(o.valence) })),
            now,
          );
        }
      }

      const entries = await repo.listChronicle(owner, PAGE_LIMIT);
      const standings = await repo.listStandings(owner, PAGE_LIMIT);
      return res.json({
        entries: entries.map((e) => ({
          at: e.at,
          text: e.text,
          valence: e.valence,
          tag: e.tag,
          aName: nameOf.get(e.aId) ?? 'a passing light',
          bName: nameOf.get(e.bId) ?? 'a passing light',
        })),
        standings: standings.map((s) => ({
          aName: nameOf.get(s.a) ?? 'a passing light',
          bName: nameOf.get(s.b) ?? 'a passing light',
          valence: s.valence,
          line: s.line,
          updatedAt: s.updatedAt,
        })),
      });
    }),
  );

  return router;
}
