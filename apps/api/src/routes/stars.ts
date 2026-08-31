/**
 * routes/stars.ts — POST /stars/:id/inscribe (ARCHITECTURE.md §13): the one bridge
 * between the game and the Sky. A signed-in Light asks for a voucher for a star they
 * raised; the API signs it; the Sky's StarNFT recovers it and strikes (or names) the
 * star. Owner-scoped (another Light's star is 404), and OFF by default: with no
 * signer configured the route is not mounted at all.
 */

import { Router, type Request } from 'express';
import type { Address } from 'viem';
import { InscribeStarRequest, InscribeStarResponse, SkyStarResponse } from '@amabo/shared';
import type { Clock } from '../clock.js';
import type { Repository } from '../repo/types.js';
import {
  VOUCHER_TTL_SECONDS,
  creatureIdOfSoul,
  hashStarMetadata,
  soulOf,
  starMetadata,
  type StarSigner,
} from '../chain/star.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /sky/stars/:id — the public record the Sky renders for a star, by creature id or
 * by its on-chain soul (bytes32). Public fields only (StarSchema), never an owner.
 * Mounted before the auth gate; absent, like the rest, while the Sky is off.
 */
export function publicStarsRouter(deps: { repo: Repository; signer?: StarSigner }): Router {
  const router = Router();
  if (!deps.signer) return router;

  router.get('/sky/stars/:id', (req, res, next) => {
    void (async () => {
      try {
        const raw = req.params.id!;
        const creatureId = creatureIdOfSoul(raw) ?? raw;
        if (!UUID.test(creatureId)) return res.status(404).json({ error: 'not found' });
        const star = await deps.repo.getStarByCreature(creatureId);
        if (!star) return res.status(404).json({ error: 'not found' });
        const meta = starMetadata(star);
        // Public, credential-free data: any origin (the Sky lives on www) may read it.
        res.set('access-control-allow-origin', '*');
        return res.json(
          SkyStarResponse.parse({
            star: meta,
            soul: soulOf(star.creatureId),
            metadataHash: hashStarMetadata(meta),
          }),
        );
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}

export function starsRouter(deps: {
  repo: Repository;
  clock: Clock;
  getOwner: (req: Request) => string | null;
  signer?: StarSigner;
}): Router {
  const { repo, clock, getOwner, signer } = deps;
  const router = Router();
  if (!signer) return router; // the Sky is off — no route exists

  router.post('/stars/:id/inscribe', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'authentication required' });
        const body = InscribeStarRequest.safeParse(req.body ?? {});
        if (!body.success) return res.status(400).json({ error: 'invalid request' });

        // Owner-scoped by construction: only this Light's stars are ever searched.
        const star = (await repo.listStars(owner)).find((s) => s.id === req.params.id);
        if (!star) return res.status(404).json({ error: 'not found' });

        const metadata = starMetadata(star);
        const voucher = {
          tokenId: body.data.tokenId,
          to: body.data.to as Address,
          creatureId: soulOf(star.creatureId),
          metadataHash: hashStarMetadata(metadata),
          deadline: Math.floor(clock() / 1000) + VOUCHER_TTL_SECONDS,
        };
        const signature = await signer.sign(voucher);
        return res.json(
          InscribeStarResponse.parse({
            voucher,
            signature,
            domain: signer.domain,
            signer: signer.address,
            metadata,
          }),
        );
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
