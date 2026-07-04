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

/**
 * Extend the book if enough dark has passed: roll encounters, voice them, persist
 * pages + standings + bond threads. Shared by GET /chronicle (the reading) and
 * GET /chronicle/pulse (the dashboard's glance) — both are gap-gated, so neither
 * can spend model calls more than once per CHRONICLE.minGapMs.
 */
async function extendChronicle(
  repo: Repository,
  chronicler: NonNullable<ChronicleDeps['chronicler']>,
  owner: string | null,
  now: number,
): Promise<void> {
  const all = await repo.listCreaturesByOwner(owner);
  const active = all.filter(
    (c) => c.state.alive && c.graduatedAt === null && c.archivedAt === null,
  );
  if (active.length < 2) return;

  const last = await repo.lastChronicleAt(owner);
  const since = last ?? now - LOOKBACK_CAP_MS;
  const elapsed = Math.min(Math.max(now - since, 0), LOOKBACK_CAP_MS);

  const seedSum = active.reduce((sum, c) => (sum + c.state.seed) >>> 0, 0);
  const rng = mulberry32(deriveSeed(seedSum, Math.floor(now / 1000)));
  const outlines = rollEncounters(
    active.map((c) => ({ id: c.id, state: c.state })),
    elapsed,
    rng,
  );
  if (outlines.length === 0) return;

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
  await repo.recordBonds(
    owner,
    outlines.map((o) => ({ a: o.aId, b: o.bId, strength: bondDeltaFor(o.valence) })),
    now,
  );
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

      await extendChronicle(repo, chronicler, owner, now);
      // Opening the book reads it: everything written so far is now seen.
      if (owner) await repo.markChronicleSeen(owner, now);

      const all = await repo.listCreaturesByOwner(owner);
      const nameOf = new Map(all.map((c) => [c.id, c.name]));
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

  // The dashboard's glance (M-L, the Living Shelf): quietly extend the book, then
  // answer "what happened while you were away?" — unread pages, the freshest line,
  // and each creature's last chosen day. Never marks the book read.
  router.get(
    '/chronicle/pulse',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const now = clock();
      await extendChronicle(repo, chronicler, owner, now);

      const seenAt = owner ? ((await repo.getUserById(owner))?.chronicleSeenAt ?? 0) : 0;
      const entries = await repo.listChronicle(owner, PAGE_LIMIT);
      const unseen = entries.filter((e) => e.at > seenAt);

      const all = await repo.listCreaturesByOwner(owner);
      const nameOf = new Map(all.map((c) => [c.id, c.name]));
      const active = all.filter(
        (c) => c.state.alive && c.graduatedAt === null && c.archivedAt === null,
      );
      const lives = await Promise.all(
        active.map(async (c) => {
          const journal = await repo.listJournal(c.id, 30, 0);
          const day = journal.find((j) => j.kind === 'daypath');
          return { id: c.id, daypath: day ? { tag: day.tag, at: day.at } : null };
        }),
      );

      const latest = unseen[0] ?? null;
      return res.json({
        chronicleNew: unseen.length,
        latest: latest
          ? {
              text: latest.text,
              at: latest.at,
              valence: latest.valence,
              aName: nameOf.get(latest.aId) ?? 'a passing light',
              bName: nameOf.get(latest.bId) ?? 'a passing light',
            }
          : null,
        lives,
      });
    }),
  );

  return router;
}
