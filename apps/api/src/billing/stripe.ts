/**
 * billing/stripe.ts — the real till, spoken over plain HTTPS (LAUNCH_PLAN.md L5).
 * Stripe's API is form-encoded REST and its webhook signature is one HMAC, so we
 * carry no SDK (same spirit as monitor.ts). Config arrives from the environment at
 * the edge (index.ts); everything else sees only the BillingPort.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BillingPort, StripeEvent } from './port.js';

export interface StripeConfig {
  secretKey: string;
  /** The Keeper's Lantern subscription price (price_…). */
  priceId: string;
  webhookSecret: string;
}

/** Webhook timestamps older than this are refused (replay window). */
const TOLERANCE_S = 10 * 60;

export function stripeBilling(cfg: StripeConfig, fetchFn: typeof fetch = fetch): BillingPort {
  const api = async (path: string, params: Record<string, string>): Promise<unknown> => {
    const res = await fetchFn(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfg.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`stripe ${path} → ${res.status}`);
    return res.json();
  };

  return {
    async createCheckout(customerEmail, userId, urls) {
      const session = (await api('checkout/sessions', {
        mode: 'subscription',
        'line_items[0][price]': cfg.priceId,
        'line_items[0][quantity]': '1',
        success_url: urls.successUrl,
        cancel_url: urls.cancelUrl,
        // The webhook maps the paid session back to this Light.
        client_reference_id: userId,
        customer_email: customerEmail,
      })) as { url: string };
      return { url: session.url };
    },

    async createPortal(customerId, returnUrl) {
      const session = (await api('billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl,
      })) as { url: string };
      return { url: session.url };
    },

    verifyWebhook(payload, signatureHeader, nowMs) {
      try {
        // Header: `t=<unix>,v1=<hex>[,v1=…]` — verify HMAC-SHA256 over `${t}.${payload}`.
        const parts = new Map<string, string[]>();
        for (const piece of signatureHeader.split(',')) {
          const [k, v] = piece.split('=', 2);
          if (!k || !v) continue;
          parts.set(k, [...(parts.get(k) ?? []), v]);
        }
        const t = Number(parts.get('t')?.[0]);
        const candidates = parts.get('v1') ?? [];
        if (!Number.isFinite(t) || candidates.length === 0) return null;
        if (Math.abs(nowMs / 1000 - t) > TOLERANCE_S) return null;

        const expected = createHmac('sha256', cfg.webhookSecret)
          .update(`${t}.${payload}`)
          .digest('hex');
        const genuine = candidates.some((v1) => {
          const a = Buffer.from(v1, 'hex');
          const b = Buffer.from(expected, 'hex');
          return a.length === b.length && timingSafeEqual(a, b);
        });
        if (!genuine) return null;
        return JSON.parse(payload) as StripeEvent;
      } catch {
        return null;
      }
    },
  };
}
