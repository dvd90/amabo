import { condenseMote, GRADUATION, type CreatureState } from '@amabo/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

const HOUR = 3_600_000;

function setup(getOwner: () => string | null = () => null) {
  const repo = new InMemoryRepository();
  let now = 1_000_000;
  const app = createApp({
    repo,
    clock: () => now,
    seed: () => 12345,
    narrator: localNarrator,
    getOwner,
  });
  return { repo, app, setNow: (t: number) => (now = t), nowAt: () => now };
}

describe('POST /creatures', () => {
  it('condenses a Mote and returns the view', async () => {
    const { app } = setup();
    const res = await request(app).post('/creatures').send({ name: 'Pip' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pip');
    expect(res.body.state.stage).toBe('mote');
    expect(res.body.graduatedAt).toBeNull();
  });

  it('rejects an invalid body with 400', async () => {
    const { app } = setup();
    const res = await request(app).post('/creatures').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /creatures/:id — lazy catch-up', () => {
  it('replays the gap so decay shows after time passes', async () => {
    const ctx = setup();
    const created = await request(ctx.app).post('/creatures').send({ name: 'Pip' });
    const id = created.body.id;
    const ambra0 = created.body.state.ambra ?? created.body.state.stats.ambra;

    ctx.setNow(ctx.nowAt() + 12 * HOUR);
    const res = await request(ctx.app).get(`/creatures/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.state.stats.ambra).toBeLessThan(ambra0);
    expect(res.body.state.ageMinutes).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown creature', async () => {
    const { app } = setup();
    const res = await request(app).get('/creatures/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /creatures/:id/interact', () => {
  it('feeds the creature and persists the result', async () => {
    const ctx = setup();
    const created = await request(ctx.app).post('/creatures').send({ name: 'Pip' });
    const id = created.body.id;

    const fed = await request(ctx.app).post(`/creatures/${id}/interact`).send({ action: 'feed' });
    expect(fed.status).toBe(200);
    expect(fed.body.events[0].kind).toBe('fed');

    const after = await request(ctx.app).get(`/creatures/${id}`);
    expect(after.body.state.stats.ambra).toBeGreaterThan(70); // persisted
  });

  it('rejects an unknown action with 400', async () => {
    const ctx = setup();
    const created = await request(ctx.app).post('/creatures').send({ name: 'Pip' });
    const res = await request(ctx.app)
      .post(`/creatures/${created.body.id}/interact`)
      .send({ action: 'scold' });
    expect(res.status).toBe(400);
  });
});

describe('POST /creatures/:id/peek', () => {
  it('returns a journal line and mood', async () => {
    const ctx = setup();
    const created = await request(ctx.app).post('/creatures').send({ name: 'Pip' });
    const res = await request(ctx.app).post(`/creatures/${created.body.id}/peek`).send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.journal).toBe('string');
    expect(typeof res.body.mood).toBe('string');
  });
});

describe('graduation writes a stars row', () => {
  it('a high-Amabo Bloom ascends on read and appears in the sky', async () => {
    const ctx = setup();
    // Seed a creature on the cusp of graduation directly through the repo.
    const base = condenseMote(99, ctx.nowAt());
    const ready: CreatureState = {
      ...base,
      stage: 'bloom',
      disposition: 90,
      ageMinutes: GRADUATION.ageMinutes + 100,
      stats: { ambra: 95, energy: 80, cleanliness: 100, health: 100, affection: 95, security: 90 },
    };
    const rec = await ctx.repo.createCreature({ ownerId: null, name: 'Lumen', state: ready });

    ctx.setNow(ctx.nowAt() + HOUR);
    const read = await request(ctx.app).get(`/creatures/${rec.id}`);
    expect(read.body.graduatedAt).not.toBeNull();

    const sky = await request(ctx.app).get(`/creatures/${rec.id}/stars`);
    expect(sky.body.stars).toHaveLength(1);
    expect(sky.body.stars[0].name).toBe('Lumen');
  });
});

describe('ownership scoping', () => {
  let id: string;
  beforeEach(async () => {
    const owned = setup(() => null);
    const created = await request(owned.app).post('/creatures').send({ name: 'Pip' });
    id = created.body.id;
    // Re-create in a shared repo so a different owner can attempt access.
  });

  it('a different owner gets 404 (existence is never leaked)', async () => {
    const repo = new InMemoryRepository();
    // Owner A creates.
    const appA = createApp({
      repo,
      clock: () => 1,
      seed: () => 1,
      narrator: localNarrator,
      getOwner: () => 'owner-a',
    });
    const created = await request(appA).post('/creatures').send({ name: 'Pip' });

    // Owner B tries to read the same creature.
    const appB = createApp({
      repo,
      clock: () => 1,
      seed: () => 1,
      narrator: localNarrator,
      getOwner: () => 'owner-b',
    });
    const res = await request(appB).get(`/creatures/${created.body.id}`);
    expect(res.status).toBe(404);
    expect(id).toBeDefined();
  });
});
