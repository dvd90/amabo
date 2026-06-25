import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

function setup(vapidPublicKey?: string) {
  const repo = new InMemoryRepository();
  const app = createApp({
    repo,
    clock: () => 1_000_000,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
    vapidPublicKey,
  });
  return { repo, app };
}

async function login(app: Express) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code: 'pip', state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string };
}

const SUB = {
  endpoint: 'https://push.example/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

describe('push notifications (M-C)', () => {
  it('serves the VAPID public key publicly (null when unset)', async () => {
    expect((await request(setup('KEY123').app).get('/push/vapid')).body.key).toBe('KEY123');
    expect((await request(setup().app).get('/push/vapid')).body.key).toBeNull();
  });

  it('stores a device subscription for the signed-in Light, and removes it', async () => {
    const { app, repo } = setup('KEY');
    const { agent, csrf } = await login(app);

    const sub = await agent
      .post('/push/subscribe')
      .set('x-csrf-token', csrf)
      .send({ subscription: SUB });
    expect(sub.status).toBe(201);
    expect(await repo.listPushSubscriptions()).toHaveLength(1);

    const off = await agent
      .post('/push/unsubscribe')
      .set('x-csrf-token', csrf)
      .send({ endpoint: SUB.endpoint });
    expect(off.status).toBe(200);
    expect(await repo.listPushSubscriptions()).toHaveLength(0);
  });

  it('rejects a malformed subscription (400) and an unauthenticated one (401)', async () => {
    const { app } = setup('KEY');
    const { agent, csrf } = await login(app);
    expect(
      (await agent.post('/push/subscribe').set('x-csrf-token', csrf).send({ subscription: {} }))
        .status,
    ).toBe(400);
    expect((await request(app).post('/push/subscribe').send({ subscription: SUB })).status).toBe(
      401,
    );
  });
});
