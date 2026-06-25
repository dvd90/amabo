/**
 * routes/push.ts — web-push subscription management (M-C). Mounted after the auth gate,
 * so a device's subscription is always tied to the signed-in Light. The actual pinging
 * is done out-of-band by the notify cron; this just stores/removes the endpoints. The
 * VAPID public key is served separately (publicly) from app.ts so the client can
 * subscribe.
 */

import { Router, type Request } from 'express';
import type { Repository } from '../repo/types.js';

export function pushRouter(deps: {
  repo: Repository;
  getOwner: (req: Request) => string | null;
}): Router {
  const { repo, getOwner } = deps;
  const router = Router();

  router.post('/push/subscribe', (req, res, next) => {
    void (async () => {
      try {
        const owner = getOwner(req);
        if (!owner) return res.status(401).json({ error: 'authentication required' });
        const sub = req.body?.subscription;
        const keys = sub?.keys;
        if (typeof sub?.endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
          return res.status(400).json({ error: 'invalid subscription' });
        }
        await repo.addPushSubscription({
          userId: owner,
          endpoint: sub.endpoint,
          p256dh: String(keys.p256dh),
          auth: String(keys.auth),
        });
        return res.status(201).json({ subscribed: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.post('/push/unsubscribe', (req, res, next) => {
    void (async () => {
      try {
        const endpoint = String(req.body?.endpoint ?? '');
        if (endpoint) await repo.deletePushSubscription(endpoint);
        return res.json({ unsubscribed: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}
