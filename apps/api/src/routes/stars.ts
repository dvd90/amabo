/**
 * routes/stars.ts — POST /stars/:id/inscribe (ARCHITECTURE.md §13): the one bridge
 * between the game and the Sky. A signed-in Light asks for a voucher for a star they
 * raised; the API signs it; the Sky's StarNFT recovers it and strikes (or names) the
 * star. Owner-scoped (another Light's star is 404), and OFF by default: with no
 * signer configured the route is not mounted at all.
 */

import { Router, type Request } from 'express';
import type { Address } from 'viem';
import { InscribeStarRequest, InscribeStarResponse } from '@amabo/shared';
import type { Clock } from '../clock.js';
import type { Repository } from '../repo/types.js';
import {
  VOUCHER_TTL_SECONDS,
  hashStarMetadata,
  soulOf,
  starMetadata,
  type StarSigner,
} from '../chain/star.js';

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
