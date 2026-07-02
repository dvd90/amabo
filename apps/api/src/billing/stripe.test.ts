import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { stripeBilling } from './stripe.js';

const CFG = { secretKey: 'sk_test_x', priceId: 'price_lantern', webhookSecret: 'whsec_test' };

function sign(payload: string, t: number, secret = CFG.webhookSecret): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('the Stripe adapter (L5) — plain HTTPS, one HMAC', () => {
  it('creates a subscription checkout with the Light stitched in', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/c/pay_x' }),
    });
    const till = stripeBilling(CFG, fetchFn as unknown as typeof fetch);
    const { url } = await till.createCheckout('light@example.com', 'user-1', {
      successUrl: 'https://web/?lantern=lit',
      cancelUrl: 'https://web/?lantern=unlit',
    });
    expect(url).toContain('checkout.stripe.com');
    const [target, init] = fetchFn.mock.calls[0]!;
    expect(target).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.headers.authorization).toBe('Bearer sk_test_x');
    const body = String(init.body);
    expect(body).toContain('mode=subscription');
    expect(body).toContain('client_reference_id=user-1');
    expect(body).toContain(encodeURIComponent('price_lantern'));
  });

  it('verifies a genuine webhook and refuses tampering, forgery, and stale replays', () => {
    const till = stripeBilling(CFG);
    const now = 1_700_000_000_000;
    const payload = JSON.stringify({ id: 'evt_1', type: 'noop', data: { object: {} } });
    const t = Math.floor(now / 1000);

    expect(till.verifyWebhook(payload, sign(payload, t), now)?.id).toBe('evt_1');
    // Tampered payload — the HMAC no longer matches.
    expect(till.verifyWebhook(payload + ' ', sign(payload, t), now)).toBeNull();
    // Signed with the wrong secret — forged.
    expect(till.verifyWebhook(payload, sign(payload, t, 'whsec_evil'), now)).toBeNull();
    // Genuine but old — outside the replay window.
    const stale = t - 11 * 60;
    expect(till.verifyWebhook(payload, sign(payload, stale), now)).toBeNull();
    // Garbage header — never throws.
    expect(till.verifyWebhook(payload, 'not-a-header', now)).toBeNull();
  });
});
