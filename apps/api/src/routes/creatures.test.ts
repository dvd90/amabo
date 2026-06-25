import { condenseMote, GRADUATION, type CreatureState } from '@amabo/engine';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

const HOUR = 3_600_000;

function setup() {
  const repo = new InMemoryRepository();
  let now = 1_000_000;
  const app = createApp({
    repo,
    clock: () => now,
    seed: () => 12345,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
  });
  return { repo, app, setNow: (t: number) => (now = t), nowAt: () => now };
}

/** Log a user in through the fake OAuth round-trip; returns a cookie-persisting agent. */
async function login(app: Express, code = 'test-user') {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code, state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

describe('auth gate', () => {
  it('rejects unauthenticated creature requests with 401', async () => {
    const { app } = setup();
    expect((await request(app).get('/creatures/x')).status).toBe(401);
    expect((await request(app).post('/creatures').send({ name: 'Pip' })).status).toBe(401);
  });
});

describe('POST /creatures', () => {
  it('condenses a Mote and returns the view', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const res = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pip');
    expect(res.body.state.stage).toBe('mote');
  });

  it('rejects a mutation without a CSRF token (403)', async () => {
    const { app } = setup();
    const { agent } = await login(app);
    const res = await agent.post('/creatures').send({ name: 'Pip' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid body with 400', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const res = await agent.post('/creatures').set('x-csrf-token', csrf).send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /creatures/:id — lazy catch-up', () => {
  it('replays the gap so decay shows after time passes', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const id = created.body.id;
    const ambra0 = created.body.state.stats.ambra;

    ctx.setNow(ctx.nowAt() + 12 * HOUR);
    const res = await agent.get(`/creatures/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.state.stats.ambra).toBeLessThan(ambra0);
    expect(res.body.state.ageMinutes).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown creature', async () => {
    const { app } = setup();
    const { agent } = await login(app);
    const res = await agent.get('/creatures/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /creatures/:id/interact', () => {
  it('feeds the creature and persists the result', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const id = created.body.id;

    const fed = await agent
      .post(`/creatures/${id}/interact`)
      .set('x-csrf-token', csrf)
      .send({ action: 'feed' });
    expect(fed.status).toBe(200);
    expect(fed.body.events[0].kind).toBe('fed');

    const after = await agent.get(`/creatures/${id}`);
    expect(after.body.state.stats.ambra).toBeGreaterThan(70);
  });
});

describe('POST /creatures/:id/peek', () => {
  it('returns a journal line and mood', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const res = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.journal).toBe('string');
    expect(typeof res.body.mood).toBe('string');
  });

  it('includes a "while you were away" summary of the elapsed gap', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });

    ctx.setNow(ctx.nowAt() + 12 * HOUR); // away for half a day
    const res = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(res.body.away.elapsedMinutes).toBe(12 * 60);
    expect(Array.isArray(res.body.away.highlights)).toBe(true);
    // 12h unattended in the dark drains Ambra — a reported change.
    expect(res.body.away.deltas.ambra).toBeLessThan(0);
  });

  it('marks lastSeenAt on peek so the roster can show "looked in" time', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    expect(created.body.lastSeenAt).toBeNull(); // never looked in yet

    ctx.setNow(ctx.nowAt() + 2 * HOUR);
    const peeked = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(peeked.body.creature.lastSeenAt).toBe(ctx.nowAt());
  });
});

describe('graduation writes a stars row', () => {
  it('a high-Amabo Bloom ascends on read and appears in the sky', async () => {
    const ctx = setup();
    const { agent, userId } = await login(ctx.app);
    const base = condenseMote(99, ctx.nowAt());
    const ready: CreatureState = {
      ...base,
      stage: 'bloom',
      disposition: 90,
      ageMinutes: GRADUATION.ageMinutes + 100,
      stats: { ambra: 95, energy: 80, cleanliness: 100, health: 100, affection: 95, security: 90 },
    };
    const rec = await ctx.repo.createCreature({ ownerId: userId, name: 'Lumen', state: ready });

    ctx.setNow(ctx.nowAt() + HOUR);
    const read = await agent.get(`/creatures/${rec.id}`);
    expect(read.body.graduatedAt).not.toBeNull();

    const sky = await agent.get(`/creatures/${rec.id}/stars`);
    expect(sky.body.stars).toHaveLength(1);
    expect(sky.body.stars[0].name).toBe('Lumen');
  });
});

describe('GET /creatures — the dashboard', () => {
  it('lists only the signed-in owner’s creatures, oldest first', async () => {
    const { app } = setup();
    const alice = await login(app, 'alice');
    await alice.agent.post('/creatures').set('x-csrf-token', alice.csrf).send({ name: 'Pip' });
    await alice.agent.post('/creatures').set('x-csrf-token', alice.csrf).send({ name: 'Bo' });

    const bob = await login(app, 'bob');
    await bob.agent.post('/creatures').set('x-csrf-token', bob.csrf).send({ name: 'Vex' });

    const mine = await alice.agent.get('/creatures');
    expect(mine.status).toBe(200);
    expect(mine.body.creatures.map((c: { name: string }) => c.name)).toEqual(['Pip', 'Bo']);
    // Each roster item carries its urgency signals for the dashboard.
    expect(Array.isArray(mine.body.creatures[0].needs)).toBe(true);

    const theirs = await bob.agent.get('/creatures');
    expect(theirs.body.creatures.map((c: { name: string }) => c.name)).toEqual(['Vex']);
  });

  it('returns an empty list (not 401) for a signed-in owner with no creatures', async () => {
    const { app } = setup();
    const { agent } = await login(app);
    const res = await agent.get('/creatures');
    expect(res.status).toBe(200);
    expect(res.body.creatures).toEqual([]);
  });
});

describe('ownership scoping', () => {
  it('a different owner gets 404 (existence is never leaked)', async () => {
    const { app } = setup();
    const alice = await login(app, 'alice');
    const created = await alice.agent
      .post('/creatures')
      .set('x-csrf-token', alice.csrf)
      .send({ name: 'Pip' });

    const bob = await login(app, 'bob');
    const res = await bob.agent.get(`/creatures/${created.body.id}`);
    expect(res.status).toBe(404);
  });
});
