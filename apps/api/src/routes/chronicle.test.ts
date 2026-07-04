import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

const HOUR = 3_600_000;
const T0 = 1_000_000;

function setup(extra: Partial<Parameters<typeof createApp>[0]> = {}) {
  const repo = new InMemoryRepository();
  let now = T0;
  const app = createApp({
    repo,
    clock: () => now,
    seed: () => 12345,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
    ...extra,
  });
  return { repo, app, setNow: (t: number) => (now = t), nowAt: () => now };
}

async function login(app: Express, code = 'test-user') {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code, state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

/** A shelf of three lights with tempers known to meet (probed: seeds 5,6,7 @ +25h → 3). */
async function shelfOfThree(agent: request.Agent, csrf: string) {
  const names = ['Pip', 'Vel', 'Mo'];
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const res = await agent
      .post('/creatures')
      .set('x-csrf-token', csrf)
      .send({ name: names[i], seed: 5 + i });
    ids.push(res.body.id as string);
  }
  return ids;
}

describe('GET /chronicle — the shelf writes its own book (STORY.md §8⅞)', () => {
  it('requires a session', async () => {
    const { app } = setup();
    expect((await request(app).get('/chronicle')).status).toBe(401);
  });

  it('after a long dark stretch, the company has met — entries, standings, threads', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    const ids = await shelfOfThree(agent, csrf);

    ctx.setNow(T0 + 25 * HOUR);
    const res = await agent.get('/chronicle');
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);
    for (const e of res.body.entries) {
      expect(typeof e.text).toBe('string');
      expect(e.text.length).toBeGreaterThan(0);
      expect(['warm', 'strained']).toContain(e.valence);
      expect(typeof e.aName).toBe('string');
      expect(typeof e.bName).toBe('string');
    }
    // Standings exist for the pairs that met…
    expect(res.body.standings.length).toBeGreaterThan(0);
    expect(res.body.standings[0].line.length).toBeGreaterThan(0);
    // …and every meeting hung a thread in the friendship sky (bond, never stats).
    const bonds = await ctx.repo.listAllBonds(userId, 50);
    expect(bonds.length).toBeGreaterThan(0);
    // The states themselves were untouched by the book (story, not fate).
    const rec = await ctx.repo.getCreature(ids[0]!, userId);
    expect(rec!.state.disposition).toBe(0);
    expect(rec!.state.stats.ambra).toBe(70);
  });

  it('reads back idempotently: an immediate second look adds no new pages', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    await shelfOfThree(agent, csrf);
    ctx.setNow(T0 + 25 * HOUR);
    const first = await agent.get('/chronicle');
    const second = await agent.get('/chronicle');
    expect(second.body.entries.length).toBe(first.body.entries.length);
  });

  it('a lone light has no company to chronicle', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Solo', seed: 5 });
    ctx.setNow(T0 + 25 * HOUR);
    const res = await agent.get('/chronicle');
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });

  it('the book is owner-scoped: another Light reads their own shelf only', async () => {
    const ctx = setup();
    const a = await login(ctx.app, 'light-a');
    await shelfOfThree(a.agent, a.csrf);
    ctx.setNow(T0 + 25 * HOUR);
    await a.agent.get('/chronicle');

    const b = await login(ctx.app, 'light-b');
    const res = await b.agent.get('/chronicle');
    expect(res.body.entries).toEqual([]);
  });
});
