import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import type { Monitor } from '../monitor.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

function setup(monitor?: Monitor) {
  const repo = new InMemoryRepository();
  const app = createApp({
    repo,
    clock: () => 1_000_000,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
    monitor,
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

describe('the funnel (L1) — POST /telemetry + server-side beats', () => {
  it('counts a logged-out visit, anonymously, without a session', async () => {
    const { repo, app } = setup();
    const res = await request(app)
      .post('/telemetry')
      .send({ anonId: 'a1', events: [{ name: 'visit' }] });
    expect(res.status).toBe(204);
    expect(await repo.countTelemetry('visit', { since: 0 })).toBe(1);
  });

  it('refuses names off the allowlist and oversized batches', async () => {
    const { app } = setup();
    const bad = await request(app)
      .post('/telemetry')
      .send({ anonId: 'a1', events: [{ name: 'drop_tables' }] });
    expect(bad.status).toBe(400);

    const flood = await request(app)
      .post('/telemetry')
      .send({ anonId: 'a1', events: Array.from({ length: 21 }, () => ({ name: 'visit' })) });
    expect(flood.status).toBe(400);
  });

  it('hears the server-side beats: signup once, creature_created, care_action, peek', async () => {
    const { repo, app } = setup();
    const u = await login(app, 'light');
    expect(await repo.countTelemetry('signup', { since: 0 })).toBe(1);

    // A RETURNING sign-in is not a second signup.
    await login(app, 'light');
    expect(await repo.countTelemetry('signup', { since: 0 })).toBe(1);

    const created = await u.agent
      .post('/creatures')
      .set('x-csrf-token', u.csrf)
      .send({ name: 'Pip' });
    expect(await repo.countTelemetry('creature_created', { since: 0 })).toBe(1);

    await u.agent
      .post(`/creatures/${created.body.id}/interact`)
      .set('x-csrf-token', u.csrf)
      .send({ action: 'feed' });
    expect(await repo.countTelemetry('care_action', { since: 0, userId: u.userId })).toBe(1);

    await u.agent.post(`/creatures/${created.body.id}/peek`).set('x-csrf-token', u.csrf).send({});
    expect(await repo.countTelemetry('peek', { since: 0 })).toBe(1);
  });

  it('forwards a client_error to the monitor (one Sentry, both apps)', async () => {
    const capture = vi.fn();
    const { app } = setup({ capture });
    await request(app)
      .post('/telemetry')
      .send({ anonId: 'a1', events: [{ name: 'client_error', props: { message: 'boom' } }] });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(String(capture.mock.calls[0]![0])).toContain('boom');
  });
});
