/**
 * routes/billing.ts — the till (LAUNCH_PLAN.md L5). Two small surfaces:
 *
 *  - authed: POST /billing/checkout (open a Keeper's Lantern subscription) and
 *    GET /billing/portal (manage/cancel) — both just mint hosted-page URLs;
 *  - public: POST /billing/webhook — signature-verified, idempotent by event id,
 *    and the ONLY writer of entitlements. Gates read the tier; nothing reads Stripe.
 *
 * With no BillingPort configured the till is politely closed (503) and the game is
 * simply free — nothing else changes. The soul is out of scope by construction:
 * entitlements touch the shelf and the voice, never souring/illness/death/redemption.
 */

import express, { Router, type Request, type Response } from 'express';
import type { Clock } from '../clock.js';
import type { BillingPort } from '../billing/port.js';
import type { Repository } from '../repo/types.js';

export interface BillingDeps {
  repo: Repository;
  clock: Clock;
  billing?: BillingPort;
  /** Where hosted pages return to (the web app). */
  webOrigin: string;
}

/** Authed till surfaces (mounted behind requireAuth + requireCsrf). */
export function billingRouter(deps: BillingDeps): Router {
  const { repo, billing, webOrigin } = deps;
  const router = Router();

  router.post('/billing/checkout', (req: Request, res: Response, next) => {
    void (async () => {
      try {
        if (!billing) return res.status(503).json({ error: 'the till is not open yet' });
        const { url } = await billing.createCheckout(req.user!.email, req.user!.id, {
          successUrl: `${webOrigin}/?lantern=lit`,
          cancelUrl: `${webOrigin}/?lantern=unlit`,
        });
        return res.json({ url });
      } catch (err) {
        next(err);
      }
    })();
  });

  router.get('/billing/portal', (req: Request, res: Response, next) => {
    void (async () => {
      try {
        if (!billing) return res.status(503).json({ error: 'the till is not open yet' });
        const customerId = req.user!.stripeCustomerId;
        if (!customerId) return res.status(404).json({ error: 'no lantern to manage' });
        const { url } = await billing.createPortal(customerId, `${webOrigin}/`);
        return res.json({ url });
      } catch (err) {
        next(err);
      }
    })();
  });

  void repo;
  return router;
}

/** The webhook — PUBLIC, raw-bodied (the signature covers the exact bytes). */
export function billingWebhookRouter(deps: BillingDeps): Router {
  const { repo, clock, billing } = deps;
  const router = Router();

  router.post(
    '/billing/webhook',
    express.raw({ type: () => true }),
    (req: Request, res: Response, next) => {
      void (async () => {
        try {
          if (!billing) return res.status(503).json({ error: 'the till is not open yet' });
          const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
          const event = billing.verifyWebhook(
            payload,
            String(req.headers['stripe-signature'] ?? ''),
            clock(),
          );
          if (!event) return res.status(400).json({ error: 'bad signature' });

          // Idempotent: each event id lands exactly once, replays are acknowledged no-ops.
          if (!(await repo.markStripeEventSeen(event.id, clock()))) {
            return res.json({ received: true, replay: true });
          }

          const obj = event.data.object;
          if (event.type === 'checkout.session.completed') {
            const userId = String(obj['client_reference_id'] ?? '');
            const customer = String(obj['customer'] ?? '');
            if (userId) {
              await repo.setEntitlements(
                userId,
                { tier: 'lantern', renewsAt: null },
                customer || undefined,
              );
            }
          } else if (event.type === 'customer.subscription.updated') {
            const user = await repo.getUserByStripeCustomer(String(obj['customer'] ?? ''));
            if (user) {
              const status = String(obj['status'] ?? '');
              const lit = status === 'active' || status === 'trialing';
              const end = Number(obj['current_period_end']);
              await repo.setEntitlements(user.id, {
                tier: lit ? 'lantern' : 'free',
                renewsAt: lit && Number.isFinite(end) ? end * 1000 : null,
              });
            }
          } else if (event.type === 'customer.subscription.deleted') {
            const user = await repo.getUserByStripeCustomer(String(obj['customer'] ?? ''));
            if (user) await repo.setEntitlements(user.id, { tier: 'free', renewsAt: null });
          }
          // Unknown event types are acknowledged so Stripe stops retrying them.
          return res.json({ received: true });
        } catch (err) {
          next(err);
        }
      })();
    },
  );

  return router;
}
