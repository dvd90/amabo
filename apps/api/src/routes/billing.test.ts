import { SLOTS } from '@amabo/shared';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import type { BillingPort, StripeEvent } from '../billing/port.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

/** A stand-in till: signature 'good:<json>' verifies; anything else is refused. */
function fakeBilling(): BillingPort {
  return {
    async createCheckout(email, userId) {
      return { url: `https://checkout.test/${userId}?email=${encodeURIComponent(email)}` };
    },
    async createPortal(customerId) {
      return { url: `https://portal.test/${customerId}` };
    },
    verifyWebhook(payload, signature) {
      if (signature !== 'good') return null;
      return JSON.parse(payload) as StripeEvent;
    },
  };
}

function setup(billing?: BillingPort) {
  const repo = new InMemoryRepository();
  const app = createApp({
    repo,
    clock: () => 1_000_000,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
    billing,
  });
  return { repo, app };
}

async function login(app: Express, code: string) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code, state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

function completedEvent(id: string, userId: string): string {
  return JSON.stringify({
    id,
    type: 'checkout.session.completed',
    data: { object: { client_reference_id: userId, customer: 'cus_1' } },
  });
}

describe('the till (L5) — checkout, webhook, and what the Lantern buys', () => {
  it('is politely closed when Stripe is not configured (503)', async () => {
    const { app } = setup();
    const u = await login(app, 'keeper');
    const res = await u.agent.post('/billing/checkout').set('x-csrf-token', u.csrf).send({});
    expect(res.status).toBe(503);
  });

  it('opens a checkout for the signed-in Light', async () => {
    const { app } = setup(fakeBilling());
    const u = await login(app, 'keeper');
    const res = await u.agent.post('/billing/checkout').set('x-csrf-token', u.csrf).send({});
    expect(res.status).toBe(200);
    expect(res.body.url).toContain(u.userId);
  });

  it('a verified webhook lights the Lantern; a bad signature never does', async () => {
    const { app } = setup(fakeBilling());
    const u = await login(app, 'keeper');

    const bad = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'forged')
      .set('content-type', 'application/json')
      .send(completedEvent('evt_1', u.userId));
    expect(bad.status).toBe(400);
    expect((await u.agent.get('/me')).body.user.entitlements.tier).toBe('free');

    const ok = await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'good')
      .set('content-type', 'application/json')
      .send(completedEvent('evt_1', u.userId));
    expect(ok.status).toBe(200);
    expect((await u.agent.get('/me')).body.user.entitlements.tier).toBe('lantern');
  });

  it('webhooks are idempotent: the same event id lands once', async () => {
    const { repo, app } = setup(fakeBilling());
    const u = await login(app, 'keeper');
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 'good')
        .set('content-type', 'application/json')
        .send(completedEvent('evt_same', u.userId));
    }
    const user = await repo.getUserById(u.userId);
    expect(user?.entitlements.tier).toBe('lantern');
    // A later cancellation still lands (different id) — replay of evt_same cannot resurrect it.
    await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'good')
      .set('content-type', 'application/json')
      .send(
        JSON.stringify({
          id: 'evt_cancel',
          type: 'customer.subscription.deleted',
          data: { object: { customer: 'cus_1' } },
        }),
      );
    expect((await repo.getUserById(u.userId))?.entitlements.tier).toBe('free');
    await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'good')
      .set('content-type', 'application/json')
      .send(completedEvent('evt_same', u.userId));
    expect((await repo.getUserById(u.userId))?.entitlements.tier).toBe('free');
  });

  it('the Lantern widens the shelf: eight lights, then the same kind refusal', async () => {
    const { app } = setup(fakeBilling());
    const u = await login(app, 'keeper');
    await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'good')
      .set('content-type', 'application/json')
      .send(completedEvent('evt_up', u.userId));

    for (let i = 0; i < SLOTS.lantern; i++) {
      const r = await u.agent
        .post('/creatures')
        .set('x-csrf-token', u.csrf)
        .send({ name: `P${i}` });
      expect(r.status).toBe(201);
    }
    const ninth = await u.agent
      .post('/creatures')
      .set('x-csrf-token', u.csrf)
      .send({ name: 'One too many' });
    expect(ninth.status).toBe(403);
    expect(ninth.body.error).toMatch(/shelf/);
  });

  it('the portal opens only for a Light the till knows', async () => {
    const { repo, app } = setup(fakeBilling());
    const u = await login(app, 'keeper');
    expect((await u.agent.get('/billing/portal')).status).toBe(404);
    await request(app)
      .post('/billing/webhook')
      .set('stripe-signature', 'good')
      .set('content-type', 'application/json')
      .send(completedEvent('evt_up', u.userId));
    void repo;
    const res = await u.agent.get('/billing/portal');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('cus_1');
  });
});
