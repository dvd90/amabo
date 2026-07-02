/**
 * routes/share.ts — sharing & resonance, off-chain (STORY.md §7¾, ARCHITECTURE.md §14).
 * Visits and postcards are PUBLIC capability-token reads (mounted before the auth gate);
 * minting/revoking links, resonance meetings, rehoming, and report/block are owner
 * actions (mounted after auth + CSRF). Share links are scoped, revocable, expiring.
 */

import {
  clamp,
  clampDisposition,
  deriveSeed,
  deriveUncanny,
  mulberry32,
  resonate,
  visitDelta,
  RESONANCE,
  type CreatureState,
  type ResonanceDelta,
} from '@amabo/engine';
import { Router, type Request } from 'express';
import type { Clock } from '../clock.js';
import { newToken } from '../auth/session.js';
import type { CreatureRecord, Repository, ShareKind } from '../repo/types.js';
import { catchUp } from '../service/catchup.js';

export interface ShareDeps {
  repo: Repository;
  clock: Clock;
  baseUrl: string;
  getOwner: (req: Request) => string | null;
  /** Where share links should open (the web app); falls back to baseUrl. */
  webOrigin?: string;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function applyDelta(state: CreatureState, delta: ResonanceDelta): CreatureState {
  const stats = { ...state.stats };
  for (const key of Object.keys(delta.stats) as (keyof typeof stats)[]) {
    stats[key] = clamp(stats[key] + (delta.stats[key] ?? 0), 0, 100);
  }
  const disposition = clampDisposition(state.disposition + delta.disposition);
  return { ...state, stats, disposition, uncanny: deriveUncanny(disposition) };
}

function isLive(link: { revokedAt: number | null; expiresAt: number }, now: number): boolean {
  return link.revokedAt === null && link.expiresAt > now;
}

/** Public, capability-token reads — no session required. */
export function publicShareRouter(deps: ShareDeps): Router {
  const { repo, clock } = deps;
  const router = Router();

  // A visit: another Light looks in (read-mostly) and gently warms the creature.
  router.post('/visit/:token', (req, res, next) => {
    void (async () => {
      try {
        const link = await repo.getShareLink(req.params.token!);
        if (!link || link.kind !== 'visit' || !isLive(link, clock())) {
          return res.status(404).json({ error: 'not found' });
        }
        const rec = await repo.getCreature(link.creatureId, link.ownerId);
        if (!rec) return res.status(404).json({ error: 'not found' });

        const { record } = await catchUp(repo, rec, clock());
        const warmed: CreatureRecord = { ...record, state: applyDelta(record.state, visitDelta()) };
        await repo.saveCreature(warmed);
        await repo.appendEvents(
          warmed.id,
          [{ at: clock(), kind: 'visit', statDeltas: {}, dispositionDelta: 0, salience: 2 }],
          'user',
        );
        // A single optional kind word becomes part of the creature's inner life.
        const word = typeof req.body?.word === 'string' ? req.body.word.slice(0, 140) : null;
        if (word) await repo.addMemories(warmed.id, [{ at: clock(), text: word, salience: 5 }]);

        return res.json({
          creature: {
            name: warmed.name,
            stage: warmed.state.stage,
            uncanny: warmed.state.uncanny,
            ambra: warmed.state.stats.ambra,
          },
          warmed: true,
        });
      } catch (err) {
        next(err);
      }
    })();
  });

  // A postcard: a public, read-only moment. Never exposes account data.
  router.get('/postcard/:token', (req, res, next) => {
    void (async () => {
      try {
        const link = await repo.getShareLink(req.params.token!);
        if (!link || link.kind !== 'postcard' || !isLive(link, clock())) {
          return res.status(404).json({ error: 'not found' });
        }
        const rec = await repo.getCreature(link.creatureId, link.ownerId);
        if (!rec) return res.status(404).json({ error: 'not found' });
        return res.json({
          name: rec.name,
          stage: rec.state.stage,
          uncanny: rec.state.uncanny,
          graduated: rec.graduatedAt !== null,
        });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}

/** Owner actions — require a session + CSRF (applied by the app before mounting). */
export function authedShareRouter(deps: ShareDeps): Router {
  const { repo, clock, baseUrl, getOwner } = deps;
  const linkBase = deps.webOrigin ?? baseUrl;
  const router = Router();

  // Mint a scoped, revocable, expiring share link.
  router.post('/creatures/:id/share', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        const rec = await repo.getCreature(req.params.id!, owner);
        if (!rec) return res.status(404).json({ error: 'not found' });
        const kind = req.body?.kind as ShareKind;
        if (kind !== 'visit' && kind !== 'meet' && kind !== 'postcard' && kind !== 'gather') {
          return res.status(400).json({ error: 'invalid share kind' });
        }
        const ttl =
          Number(req.body?.ttlMinutes) > 0 ? Number(req.body.ttlMinutes) * 60_000 : DEFAULT_TTL_MS;
        const link = await repo.createShareLink({
          creatureId: rec.id,
          ownerId: owner,
          kind,
          token: newToken(),
          expiresAt: clock() + ttl,
        });
        // Open in the web app's public viewer (not the raw JSON API endpoint).
        const url = `${linkBase}/look/${link.token}?k=${kind}`;
        return res.status(201).json({ token: link.token, kind, expiresAt: link.expiresAt, url });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.delete('/share/:token', (req, res, next) => {
    void (async () => {
      try {
        const ok = await repo.revokeShareLink(req.params.token!, getOwner(req), clock());
        if (!ok) return res.status(404).json({ error: 'not found' });
        return res.json({ revoked: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  // A resonance meeting: my creature meets another via its owner's 'meet' token.
  router.post('/creatures/:id/meet', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        const mine = await repo.getCreature(req.params.id!, owner);
        if (!mine) return res.status(404).json({ error: 'not found' });
        const link = await repo.getShareLink(String(req.body?.token ?? ''));
        if (!link || link.kind !== 'meet' || !isLive(link, clock())) {
          return res.status(404).json({ error: 'meeting not found' });
        }
        const other = await repo.getCreature(link.creatureId, link.ownerId);
        if (!other) return res.status(404).json({ error: 'meeting not found' });
        if (other.id === mine.id)
          return res.status(400).json({ error: 'a creature cannot meet itself' });

        const now = clock();
        const a = (await catchUp(repo, mine, now)).record;
        const b = (await catchUp(repo, other, now)).record;
        const rng = mulberry32(deriveSeed(a.state.seed, b.state.seed));
        const { events, deltasA, deltasB } = resonate(a.state, b.state, rng);

        await repo.saveCreature({ ...a, state: applyDelta(a.state, deltasA) });
        await repo.saveCreature({ ...b, state: applyDelta(b.state, deltasB) });
        await repo.appendEvents(a.id, events, 'sim');
        await repo.appendEvents(b.id, events, 'sim');
        return res.json({ result: events[0]?.tag, events });
      } catch (err) {
        next(err);
      }
    })();
  });

  // A meeting between two of your OWN creatures — a duet within one Amarium (M-H).
  // A harmony hangs a THIN thread in the friendship sky and must settle before the
  // same pair meets again (M-I) — the disposition pull is a gift, not a pump.
  router.post('/creatures/:id/meet/:otherId', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        if (req.params.id === req.params.otherId) {
          return res.status(400).json({ error: 'a creature cannot meet itself' });
        }
        const a0 = await repo.getCreature(req.params.id!, owner);
        const b0 = await repo.getCreature(req.params.otherId!, owner);
        if (!a0 || !b0) return res.status(404).json({ error: 'not found' });

        const now = clock();
        const bonds = await repo.listBonds(owner, a0.id);
        const prior = bonds.find(
          (x) =>
            (x.creatureA === a0.id && x.creatureB === b0.id) ||
            (x.creatureA === b0.id && x.creatureB === a0.id),
        );
        if (prior && now - prior.lastMetAt < RESONANCE.pairCooldownMinutes * 60_000) {
          return res.status(429).json({ error: 'they have just met — let it settle' });
        }

        const a = (await catchUp(repo, a0, now)).record;
        const b = (await catchUp(repo, b0, now)).record;
        const rng = mulberry32(deriveSeed(a.state.seed, b.state.seed));
        const { events, deltasA, deltasB } = resonate(a.state, b.state, rng);

        await repo.saveCreature({ ...a, state: applyDelta(a.state, deltasA) });
        await repo.saveCreature({ ...b, state: applyDelta(b.state, deltasB) });
        await repo.appendEvents(a.id, events, 'sim');
        await repo.appendEvents(b.id, events, 'sim');
        if (events[0]?.tag === 'harmony') {
          await repo.recordBonds(
            owner,
            [{ a: a.id, b: b.id, strength: RESONANCE.bondStrength }],
            now,
          );
        }
        return res.json({ result: events[0]?.tag ?? 'harmony', names: [a.name, b.name] });
      } catch (err) {
        next(err);
      }
    })();
  });

  // The accept inbox: pending rehomes addressed to me.
  router.get('/rehomes/incoming', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'authentication required' });
        return res.json({ incoming: await repo.listIncomingRehomes(owner) });
      } catch (err) {
        next(err);
      }
    })();
  });

  // Rehoming: a deliberate, two-sided act of entrusting — addressed by email. The sender
  // confirms by initiating; ownership only moves once the recipient accepts (confirm).
  router.post('/creatures/:id/rehome', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        const rec = await repo.getCreature(req.params.id!, owner);
        if (!rec || !owner) return res.status(404).json({ error: 'not found' });
        const toEmail = String(req.body?.toEmail ?? '').trim();
        if (!toEmail) return res.status(400).json({ error: 'a recipient email is required' });
        const recipient = await repo.getUserByEmail(toEmail);
        if (!recipient) return res.status(404).json({ error: 'no Light with that email yet' });
        if (recipient.id === owner)
          return res.status(400).json({ error: 'you already keep this one' });
        const rehome = await repo.initiateRehome({
          creatureId: rec.id,
          fromUserId: owner,
          toUserId: recipient.id,
          fromConfirmedAt: clock(),
          at: clock(),
        });
        return res.status(201).json({ rehome });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.post('/rehome/:id/confirm', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        if (!owner) return res.status(404).json({ error: 'not found' });
        const rehome = await repo.confirmRehome(req.params.id!, owner, clock());
        if (!rehome) return res.status(404).json({ error: 'not found' });
        return res.json({ rehome });
      } catch (err) {
        next(err);
      }
    })();
  });

  // Safety surfaces.
  router.post('/report', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        await repo.addReport(
          owner ?? 'anon',
          String(req.body?.subject ?? ''),
          req.body?.reason ?? null,
          clock(),
        );
        return res.status(201).json({ reported: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.post('/block', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'authentication required' });
        await repo.addBlock(owner, String(req.body?.blockedUserId ?? ''), clock());
        return res.status(201).json({ blocked: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
