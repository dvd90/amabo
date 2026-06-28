import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

function setup() {
  const repo = new InMemoryRepository();
  const now = 1_000_000;
  const app = createApp({
    repo,
    clock: () => now,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
  });
  return { repo, app, now };
}

async function login(app: Express, code: string) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code, state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

async function makeCreature(agent: ReturnType<typeof request.agent>, csrf: string, name: string) {
  const r = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name });
  return r.body.id as string;
}

describe('the Symposium (M-S)', () => {
  it('holds a gathering, returns the conversation + outcomes, and persists it', async () => {
    const { app } = setup();
    const u = await login(app, 'host');
    const a = await makeCreature(u.agent, u.csrf, 'Pip');
    const b = await makeCreature(u.agent, u.csrf, 'Bo');

    const held = await u.agent
      .post('/symposium/gather')
      .set('x-csrf-token', u.csrf)
      .send({ creatureIds: [a, b] });
    expect(held.status).toBe(200);
    expect(held.body.participants).toHaveLength(2);
    // two fresh Motes (disposition 0) harmonise, and the transcript is voiced
    expect(held.body.connections[0].kind).toBe('harmony');
    expect(held.body.transcript.length).toBeGreaterThan(0);

    // it can be read back, owner-scoped
    const read = await u.agent.get(`/symposium/${held.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(held.body.id);

    // a bond formed and shows on each creature's friends list
    const friends = await u.agent.get(`/symposium/friends/${a}`);
    expect(friends.body.friends.map((f: { id: string }) => f.id)).toContain(b);
  });

  it('needs at least two creatures, and only your own', async () => {
    const { app } = setup();
    const u = await login(app, 'host');
    const a = await makeCreature(u.agent, u.csrf, 'Pip');
    const tooFew = await u.agent
      .post('/symposium/gather')
      .set('x-csrf-token', u.csrf)
      .send({ creatureIds: [a] });
    expect(tooFew.status).toBe(400);

    // another Light's creature can't be pulled into your glade (404, never leaked)
    const other = await login(app, 'stranger');
    const theirs = await makeCreature(other.agent, other.csrf, 'Far');
    const crossed = await u.agent
      .post('/symposium/gather')
      .set('x-csrf-token', u.csrf)
      .send({ creatureIds: [a, theirs] });
    expect(crossed.status).toBe(404);
  });

  it("warms a Yim back toward the light by its companions' company", async () => {
    const { app, repo, now } = setup();
    const u = await login(app, 'host');
    const bright = await makeCreature(u.agent, u.csrf, 'Sol');
    const yimId = await makeCreature(u.agent, u.csrf, 'Yearn');

    // sour the second creature into a Yim (within harmony range of the bright one)
    const rec = (await repo.getCreature(yimId, u.userId))!;
    await repo.saveCreature({
      ...rec,
      state: { ...rec.state, disposition: -35, uncanny: true, lastTickAt: now },
    });

    const held = await u.agent
      .post('/symposium/gather')
      .set('x-csrf-token', u.csrf)
      .send({ creatureIds: [bright, yimId] });
    const yimOutcome = held.body.outcomes.find((o: { id: string }) => o.id === yimId);
    expect(yimOutcome.warmed).toBe(true);

    // its stored disposition actually rose (drawn back toward the light)
    const after = (await repo.getCreature(yimId, u.userId))!;
    expect(after.state.disposition).toBeGreaterThan(-35);
  });
});
