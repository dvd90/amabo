import { SLOTS } from '@amabo/shared';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

function setup() {
  const repo = new InMemoryRepository();
  const app = createApp({
    repo,
    clock: () => 1_000_000,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
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

describe('the shelf (L4) — three lights free, kindly refused past that', () => {
  it('holds three active lights; the fourth condense is refused with the lore line', async () => {
    const { app } = setup();
    const u = await login(app, 'keeper');
    for (let i = 0; i < SLOTS.free; i++) {
      const r = await u.agent
        .post('/creatures')
        .set('x-csrf-token', u.csrf)
        .send({ name: `P${i}` });
      expect(r.status).toBe(201);
    }
    const fourth = await u.agent
      .post('/creatures')
      .set('x-csrf-token', u.csrf)
      .send({ name: 'One too many' });
    expect(fourth.status).toBe(403);
    expect(fourth.body.error).toMatch(/shelf/);
  });

  it('ended and archived lights never count against the shelf', async () => {
    const { repo, app } = setup();
    const u = await login(app, 'keeper');
    const ids: string[] = [];
    for (let i = 0; i < SLOTS.free; i++) {
      const r = await u.agent
        .post('/creatures')
        .set('x-csrf-token', u.csrf)
        .send({ name: `P${i}` });
      ids.push(r.body.id as string);
    }
    // One ascends and is laid to rest — its slot opens again.
    const rec = (await repo.getCreature(ids[0]!, u.userId))!;
    await repo.saveCreature({ ...rec, graduatedAt: 999_000 });
    await repo.archiveCreature(ids[0]!, u.userId, 999_500);

    const again = await u.agent
      .post('/creatures')
      .set('x-csrf-token', u.csrf)
      .send({ name: 'Room again' });
    expect(again.status).toBe(201);
  });

  it('a full shelf also pauses the Symposium split — multiply waits for room', async () => {
    const { repo, app } = setup();
    const u = await login(app, 'keeper');
    const ids: string[] = [];
    for (let i = 0; i < SLOTS.free; i++) {
      const r = await u.agent
        .post('/creatures')
        .set('x-csrf-token', u.csrf)
        .send({ name: `P${i}` });
      ids.push(r.body.id as string);
    }
    // Make the first overflow (bloom + brimming ambra) so only the shelf can refuse.
    const rec = (await repo.getCreature(ids[0]!, u.userId))!;
    await repo.saveCreature({
      ...rec,
      state: {
        ...rec.state,
        stage: 'bloom',
        stats: { ...rec.state.stats, ambra: 100 },
        lastTickAt: 1_000_000,
      },
    });
    const split = await u.agent
      .post(`/creatures/${ids[0]}/multiply`)
      .set('x-csrf-token', u.csrf)
      .send({});
    expect(split.status).toBe(403);
    expect(split.body.error).toMatch(/shelf/);
  });
});
