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

import { localChronicle } from '@amabo/ai';
import { Router, type Request } from 'express';
import type { Clock } from '../clock.js';
import type { Repository } from '../repo/types.js';
import { extendChronicle, type Chronicler } from '../service/chronicle.js';

const PAGE_LIMIT = 50;

export interface ChronicleDeps {
  repo: Repository;
  clock: Clock;
  getOwner: (req: Request) => string | null;
  /** Writes the book (AI in prod, seeded local by default) — never trusted upstream. */
  chronicler?: Chronicler;
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
