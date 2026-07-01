/**
 * routes/symposium.ts — hold and read a gathering (STORY.md §6½, the Symposium). An
 * owner gathers 2+ of THEIR OWN creatures; we catch each up, run the pure `engine.gather`
 * rule, apply the outcomes, record the bonds that formed, narrate the conversation, and
 * persist the whole thing. Owner-scoped throughout (cross-owner ids → 404). CSRF-guarded.
 */

import {
  clamp,
  clampDisposition,
  deriveSeed,
  deriveUncanny,
  gather,
  mulberry32,
  type CreatureState,
  type GatherParticipant,
  type ResonanceDelta,
} from '@amabo/engine';
import { Router, type Request, type Response } from 'express';
import type { Clock } from '../clock.js';
import { byIp, rateLimit } from '../rateLimit.js';
import { catchUp } from '../service/catchup.js';
import type { CreatureRecord, GatheringRecord, Repository } from '../repo/types.js';
import type { SymposiumNarrator, SymposiumParticipant } from '../narrate/symposium.js';
import { writeLetter } from '../narrate/letter.js';

export interface SymposiumDeps {
  repo: Repository;
  clock: Clock;
  narrator: SymposiumNarrator;
  getOwner: (req: Request) => string | null;
}

const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 8;
// A gathering narrates the whole company (real AI spend once the model is on) — generous
// for any real evening of tending, a wall against scripted abuse.
const GATHER_MAX = 20;
const GATHER_WINDOW_MS = 60 * 60 * 1000;

/** A share link is usable while it is neither revoked nor expired. */
function linkLive(link: { revokedAt: number | null; expiresAt: number }, now: number): boolean {
  return link.revokedAt === null && link.expiresAt > now;
}

function applyDelta(state: CreatureState, delta: ResonanceDelta): CreatureState {
  const stats = { ...state.stats };
  for (const key of Object.keys(delta.stats) as (keyof typeof stats)[]) {
    stats[key] = clamp(stats[key] + (delta.stats[key] ?? 0), 0, 100);
  }
  const disposition = clampDisposition(state.disposition + delta.disposition);
  return { ...state, stats, disposition, uncanny: deriveUncanny(disposition) };
}

/** The public view of a held gathering (the web maps ids → names from `participants`). */
function toView(rec: GatheringRecord, parts: SymposiumParticipant[]) {
  return {
    id: rec.id,
    at: rec.at,
    participants: parts.map((p) => ({
      id: p.id,
      name: p.name,
      stage: p.stage,
      uncanny: p.uncanny,
      guest: p.guest ?? false,
    })),
    connections: rec.outline.connections,
    moments: rec.outline.moments,
    outcomes: rec.outline.outcomes.map((o) => ({
      id: o.id,
      warmed: o.warmed,
      comfortedById: o.comfortedById,
      bondedWith: o.bondedWith,
    })),
    transcript: rec.transcript ?? [],
  };
}

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: import('express').NextFunction) =>
    void fn(req, res).catch(next);

export function symposiumRouter(deps: SymposiumDeps): Router {
  const { repo, clock, narrator, getOwner } = deps;
  const router = Router();
  const gatherLimiter = rateLimit({
    windowMs: GATHER_WINDOW_MS,
    max: GATHER_MAX,
    keyOf: (req) => getOwner(req) ?? byIp(req),
    clock,
    message: 'too many gatherings at once — slow down and try again shortly',
  });

  // Hold a gathering of the signed-in Light's own creatures — and, by mutual consent,
  // guests from another Light's Amarium, brought in on a 'gather' pass (STORY.md §6¾).
  router.post(
    '/symposium/gather',
    gatherLimiter,
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const body = req.body as { creatureIds?: unknown; topic?: unknown; guestTokens?: unknown };
      const raw = body.creatureIds;
      const ownIds = Array.isArray(raw)
        ? [...new Set(raw.filter((x) => typeof x === 'string'))]
        : [];
      const rawTokens = body.guestTokens;
      const guestTokens = Array.isArray(rawTokens)
        ? [...new Set(rawTokens.filter((x) => typeof x === 'string'))]
        : [];
      // An optional theme the talk circles; trimmed + capped so it stays a short phrase.
      const topic =
        typeof body.topic === 'string' && body.topic.trim()
          ? body.topic.trim().slice(0, 60)
          : undefined;

      // Crossing worlds needs a signed-in host: we must be able to check consent + blocks.
      if (guestTokens.length > 0 && !owner) {
        return res.status(401).json({ error: 'sign in to host a cross-world gathering' });
      }

      // Load + catch up the host's own creatures. A missing/cross-owner id is a 404.
      const ownSet = new Set<string>(ownIds as string[]);
      const guestSet = new Set<string>();
      const records: CreatureRecord[] = [];
      for (const id of ownIds as string[]) {
        const rec = await repo.getCreature(id, owner);
        if (!rec) return res.status(404).json({ error: 'not found' });
        const { record } = await catchUp(repo, rec, clock());
        records.push(record);
      }

      // Resolve each guest pass: a scoped, live 'gather' token authorises bringing another
      // Light's creature. A block (either way) closes the glade — reported as 404, never 403.
      for (const token of guestTokens as string[]) {
        const link = await repo.getShareLink(token);
        if (!link || link.kind !== 'gather' || !linkLive(link, clock())) {
          return res.status(404).json({ error: 'guest pass not found' });
        }
        if (
          link.ownerId &&
          link.ownerId !== owner &&
          (await repo.blockedBetween(owner!, link.ownerId))
        ) {
          return res.status(404).json({ error: 'guest pass not found' });
        }
        const guest = await repo.getCreature(link.creatureId, link.ownerId);
        if (!guest) return res.status(404).json({ error: 'guest pass not found' });
        // Skip a creature already present (one of your own, or the same pass twice).
        if (ownSet.has(guest.id) || guestSet.has(guest.id)) continue;
        const { record } = await catchUp(repo, guest, clock());
        records.push(record);
        if (record.ownerId !== owner) guestSet.add(record.id);
      }

      if (records.length < MIN_PARTICIPANTS || records.length > MAX_PARTICIPANTS) {
        return res
          .status(400)
          .json({ error: `gather between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} creatures` });
      }
      if (ownIds.length < 1) {
        return res.status(400).json({ error: 'gather at least one of your own creatures' });
      }

      const participants: GatherParticipant[] = records.map((r) => ({ id: r.id, state: r.state }));
      const seedSum = records.reduce((s, r) => s ^ (r.state.seed >>> 0), 0);
      const rng = mulberry32(deriveSeed(seedSum, clock()));
      const result = gather(participants, rng);

      // Apply each outcome and write a journal marker; never touches illness/death. Each
      // record carries its TRUE owner, so a guest's change is saved to its own Amarium and
      // its Light reads the memory later.
      const byId = new Map(records.map((r) => [r.id, r]));
      for (const outcome of result.outcomes) {
        const rec = byId.get(outcome.id)!;
        await repo.saveCreature({ ...rec, state: applyDelta(rec.state, outcome.delta) });
      }
      for (let i = 0; i < records.length; i++) {
        await repo.appendEvents(records[i]!.id, [result.events[i]!], 'sim');
      }

      // Lasting bonds + letters stay within the host's own found-family (STORY.md §6¾): a
      // guest's visit is felt and journaled, but the standing constellation is yours.
      const ownBonds = result.bonds.filter((b) => ownSet.has(b.a) && ownSet.has(b.b));
      await repo.recordBonds(
        owner,
        ownBonds.map((b) => ({ a: b.a, b: b.b, strength: b.strength })),
        clock(),
      );

      // Each new bond leaves a letter: the brighter creature reaches out to the other,
      // so a friendship goes on between gatherings.
      const letters: { from: string; to: string; text: string }[] = [];
      for (const b of ownBonds) {
        const ra = byId.get(b.a)!;
        const rb = byId.get(b.b)!;
        const author = ra.state.disposition >= rb.state.disposition ? ra : rb;
        const recipient = author === ra ? rb : ra;
        const text = writeLetter(
          { name: author.name, uncanny: author.state.uncanny },
          { name: recipient.name },
          author.state.seed,
        );
        await repo.createLetter({
          ownerId: owner,
          fromCreature: author.id,
          toCreature: recipient.id,
          at: clock(),
          text,
        });
        letters.push({ from: author.name, to: recipient.name, text });
      }

      const symParts: SymposiumParticipant[] = records.map((r) => ({
        id: r.id,
        name: r.name,
        uncanny: r.state.uncanny,
        stage: r.state.stage,
        disposition: r.state.disposition,
        guest: guestSet.has(r.id),
      }));
      const transcript = await narrator.narrate({ participants: symParts, outline: result, topic });

      const rec = await repo.createGathering({
        ownerId: owner,
        at: clock(),
        participantIds: records.map((r) => r.id),
        outline: result,
        transcript,
      });
      return res.json({ ...toView(rec, symParts), letters });
    }),
  );

  // The letters among an owner's creatures (the pen-pal inbox), most recent first.
  router.get(
    '/symposium/letters',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const rows = await repo.listLetters(owner, 50);
      const nameOf = new Map<string, string>();
      const resolve = async (id: string) => {
        if (!nameOf.has(id)) {
          const c = await repo.getCreature(id, owner);
          nameOf.set(id, c?.name ?? 'someone');
        }
        return nameOf.get(id)!;
      };
      const out = [];
      for (const l of rows) {
        out.push({
          id: l.id,
          from: await resolve(l.fromCreature),
          to: await resolve(l.toCreature),
          text: l.text,
          at: l.at,
        });
      }
      return res.json({ letters: out });
    }),
  );

  // The whole friendship sky: every bond among an owner's creatures, as stars + threads.
  // (Registered before /:id so the literal path isn't captured as an id.)
  router.get(
    '/symposium/sky',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const bonds = await repo.listAllBonds(owner, 200);
      const ids = new Set<string>();
      for (const b of bonds) {
        ids.add(b.creatureA);
        ids.add(b.creatureB);
      }
      const stars: { id: string; name: string; uncanny: boolean }[] = [];
      const known = new Set<string>();
      for (const id of ids) {
        const c = await repo.getCreature(id, owner);
        if (c) {
          stars.push({ id: c.id, name: c.name, uncanny: c.state.uncanny });
          known.add(c.id);
        }
      }
      const threads = bonds
        .filter((b) => known.has(b.creatureA) && known.has(b.creatureB))
        .map((b) => ({
          a: b.creatureA,
          b: b.creatureB,
          strength: b.strength,
          metCount: b.metCount,
        }));
      return res.json({ stars, threads });
    }),
  );

  // Read a past gathering (owner-scoped).
  router.get(
    '/symposium/:id',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const rec = await repo.getGathering(req.params.id!, owner);
      if (!rec) return res.status(404).json({ error: 'not found' });
      // Re-derive the participant display names from their current records.
      const parts: SymposiumParticipant[] = [];
      for (const id of rec.participantIds) {
        const c = await repo.getCreature(id, owner);
        if (c)
          parts.push({
            id: c.id,
            name: c.name,
            uncanny: c.state.uncanny,
            stage: c.state.stage,
            disposition: c.state.disposition,
          });
      }
      return res.json(toView(rec, parts));
    }),
  );

  // A creature's friends (the bonds it has formed), strongest first.
  router.get(
    '/symposium/friends/:creatureId',
    asyncHandler(async (req, res) => {
      const owner = getOwner(req);
      const me = await repo.getCreature(req.params.creatureId!, owner);
      if (!me) return res.status(404).json({ error: 'not found' });
      const bonds = await repo.listBonds(owner, me.id);
      const friends = [];
      for (const b of bonds) {
        const otherId = b.creatureA === me.id ? b.creatureB : b.creatureA;
        const other = await repo.getCreature(otherId, owner);
        if (other) {
          friends.push({
            id: other.id,
            name: other.name,
            uncanny: other.state.uncanny,
            strength: b.strength,
            metCount: b.metCount,
            lastMetAt: b.lastMetAt,
          });
        }
      }
      return res.json({ friends });
    }),
  );

  return router;
}
