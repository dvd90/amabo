import { condenseMote, GRADUATION, type CreatureState } from '@amabo/engine';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

const HOUR = 3_600_000;

function setup(extra: Partial<Parameters<typeof createApp>[0]> = {}) {
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
    ...extra,
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

  it('keeps the Mote met at the door: an optional seed flows into the creature', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const res = await agent
      .post('/creatures')
      .set('x-csrf-token', csrf)
      .send({ name: 'Pip', seed: 99 });
    expect(res.status).toBe(201);
    expect(res.body.state.seed).toBe(99); // not the server's default seed()
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

describe('the Soulmark (STORY.md §8½)', () => {
  it('every newborn carries one, persisted, and no two are alike', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const a = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const b = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Bo' });

    expect(a.body.persona.essence.length).toBeGreaterThan(0);
    expect(a.body.persona.temperament.length).toBeGreaterThan(0);
    expect(a.body.persona.loves.length).toBeGreaterThan(0);
    expect(a.body.persona.quirk.length).toBeGreaterThan(0);
    // Unique even with the server's fixed seed — the creature's id is the salt.
    expect(JSON.stringify(a.body.persona)).not.toEqual(JSON.stringify(b.body.persona));

    // Set once at condensation and persisted — the same mark on every later read.
    const read = await agent.get(`/creatures/${a.body.id}`);
    expect(read.body.persona).toEqual(a.body.persona);
  });

  it('the door Mote (demo birth) is marked too, uniquely per seed', async () => {
    const { app } = setup();
    const one = await request(app).get('/demo/birth');
    expect(one.body.creature.persona.essence.length).toBeGreaterThan(0);
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

  it('marks lastSeenAt on create (the first look-in) and updates it on peek', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    expect(created.body.lastSeenAt).toBe(ctx.nowAt()); // condensing it counts as looking in

    ctx.setNow(ctx.nowAt() + 2 * HOUR);
    const peeked = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(peeked.body.creature.lastSeenAt).toBe(ctx.nowAt());
  });

  it('measures the away gap from the last look-in, not background catch-up', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const id = created.body.id;
    await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf).send({}); // look in at T0

    ctx.setNow(ctx.nowAt() + 3 * HOUR);
    await agent.get('/creatures'); // dashboard catch-up advances lastTickAt — NOT a look-in

    const peeked = await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf).send({});
    // The gap is measured from the last peek (3h ago), not the just-now catch-up.
    expect(peeked.body.away.elapsedMinutes).toBe(3 * 60);
  });
});

describe('the Little World (STORY.md §8¾) — daypaths and the manner', () => {
  it('after a long dark stretch the creature has chosen its day and carries a manner', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Vel' });
    const id = created.body.id;

    ctx.setNow(ctx.nowAt() + 5 * HOUR); // long enough for a dealt day
    const peeked = await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf).send({});
    expect(peeked.status).toBe(200);

    // The chosen day lands in the journal like any other lived moment.
    const journal = await ctx.repo.listJournal(id, 50, 0);
    const daypath = journal.find((e) => e.kind === 'daypath');
    expect(daypath).toBeTruthy();
    expect(daypath!.tag).toBeTruthy();
    // The manner rides the view and is persisted on the record.
    expect(peeked.body.creature.manner.ritual.length).toBeGreaterThan(0);
    expect(peeked.body.creature.manner.haunt.length).toBeGreaterThan(0);
    const rec = await ctx.repo.getCreature(id, userId);
    expect(rec!.manner).not.toBeNull();
    // The dealer's law: a chosen day is pure flavor, never fate — the state the
    // device sees is exactly the state the simulation alone produced.
    expect(rec!.state.disposition).toBe(peeked.body.creature.state.disposition);
  });

  it('a short look-away deals no day', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });

    ctx.setNow(ctx.nowAt() + 1 * HOUR); // under the threshold
    const peeked = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    const journal = await ctx.repo.listJournal(created.body.id, 50, 0);
    expect(journal.find((e) => e.kind === 'daypath')).toBeUndefined();
    expect(peeked.body.creature.manner ?? null).toBeNull();
  });

  it('an untrusted director cannot bend the world: nonsense is discarded at the boundary', async () => {
    // A director that answers an off-hand pick and an invalid manner.
    const rogue = async () => ({
      choiceId: 'grant-me-all-the-ambra',
      manner: { haunt: 'the-moon', ritual: '', obsession: '', gait: 'sprint' } as never,
      source: 'model' as const,
    });
    const ctx = setup({ direct: rogue });
    const { agent, csrf, userId } = await login(ctx.app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Yim' });
    const id = created.body.id;

    ctx.setNow(ctx.nowAt() + 5 * HOUR);
    const peeked = await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf).send({});
    expect(peeked.status).toBe(200);
    // The engine collapses the off-hand pick to the first-dealt path — a day still lands…
    const journal = await ctx.repo.listJournal(id, 50, 0);
    expect(journal.find((e) => e.kind === 'daypath')).toBeTruthy();
    // …but the invalid manner is refused at the boundary and never persisted.
    const rec = await ctx.repo.getCreature(id, userId);
    expect(rec!.manner).toBeNull();
    expect(peeked.body.creature.manner ?? null).toBeNull();
  });
});

describe('keepsakes (STORY.md §8¾) — made things stay', () => {
  it('a makerly chosen day leaves a named keepsake on the shelf', async () => {
    // A director that always picks the maker option when dealt (valid manner).
    const maker = async (input: { options: { id: string; tag: string }[] }) => {
      const pick = input.options.find((o) => o.tag === 'builtSmallThing') ?? input.options[0]!;
      return {
        choiceId: pick.id,
        manner: { haunt: 'glass', ritual: 'taps once', obsession: 'the smudge', gait: 'drift' },
        made: pick.tag === 'builtSmallThing' ? 'a little door for the smudge' : undefined,
        source: 'model' as const,
      };
    };
    const ctx = setup({ direct: maker as never });
    const { agent, csrf } = await login(ctx.app);
    // Amabo-leaning deals from the makerly pool — warm the disposition first.
    const created = await agent
      .post('/creatures')
      .set('x-csrf-token', csrf)
      .send({ name: 'Vel', seed: 5 });
    const id = created.body.id;
    const rec = await ctx.repo.getCreature(id, (await agent.get('/me')).body.user.id);
    await ctx.repo.saveCreature({ ...rec!, state: { ...rec!.state, disposition: 50 } });

    ctx.setNow(ctx.nowAt() + 5 * HOUR);
    await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf).send({});

    const res = await agent.get('/keepsakes');
    expect(res.status).toBe(200);
    // The amabo pool deals makers often; when one was chosen, the keepsake is kept.
    for (const k of res.body.keepsakes) {
      expect(k.name.length).toBeGreaterThan(0);
      expect(k.creatureName).toBe('Vel');
    }
    if (res.body.keepsakes.length > 0) {
      expect(res.body.keepsakes[0].name).toBe('a little door for the smudge');
    }
  });

  it('the museum is owner-scoped and empty for a fresh Light', async () => {
    const ctx = setup();
    const { agent } = await login(ctx.app, 'someone-else');
    const res = await agent.get('/keepsakes');
    expect(res.body.keepsakes).toEqual([]);
  });
});

describe("the Keeper's Key — a DB-only flag that unlocks everything", () => {
  it('an unlocked Light has no shelf cap: creates past free AND lantern widths', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    await ctx.repo.setUnlocked(userId, true); // what `UPDATE users SET unlocked=true` does
    for (let i = 0; i < 9; i++) {
      const res = await agent
        .post('/creatures')
        .set('x-csrf-token', csrf)
        .send({ name: `M${i}` });
      expect(res.status).toBe(201); // free caps at 3, lantern at 8 — the key opens both
    }
  });

  it('without the key the free shelf still holds three', async () => {
    const ctx = setup();
    const { agent, csrf } = await login(ctx.app);
    for (let i = 0; i < 4; i++) {
      const res = await agent
        .post('/creatures')
        .set('x-csrf-token', csrf)
        .send({ name: `M${i}` });
      expect(res.status).toBe(i < 3 ? 201 : 403);
    }
  });

  it('/me shows the key holder as fully lit (so the UI drops every upsell)', async () => {
    const ctx = setup();
    const { agent, userId } = await login(ctx.app);
    await ctx.repo.setUnlocked(userId, true);
    const me = await agent.get('/me');
    expect(me.body.user.unlocked).toBe(true);
    expect(me.body.user.entitlements.tier).toBe('lantern');
  });

  it('the key can never arrive over the wire — no API surface writes it', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    // Try the obvious smuggling routes: preferences patch and age confirmation.
    await agent
      .patch('/me/preferences')
      .set('x-csrf-token', csrf)
      .send({ unlocked: true, theme: 'dusk' });
    await agent.post('/me/age').set('x-csrf-token', csrf).send({ ageBand: '18+', unlocked: true });
    const user = await ctx.repo.getUserById(userId);
    expect(user!.unlocked).toBe(false);
  });
});

describe('POST /creatures/:id/multiply — the Symposium split (M-F)', () => {
  it('refuses a creature that is not overflowing (409)', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const res = await agent
      .post(`/creatures/${created.body.id}/multiply`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(res.status).toBe(409);
  });

  it('splits an overflowing creature into a second half on the roster', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    const base = condenseMote(7, ctx.nowAt());
    const overflowing: CreatureState = {
      ...base,
      stage: 'velveteen',
      stats: { ...base.stats, ambra: 98 },
    };
    const rec = await ctx.repo.createCreature({ ownerId: userId, name: 'Bo', state: overflowing });

    const res = await agent
      .post(`/creatures/${rec.id}/multiply`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.child.name).toMatch(/Bo/);
    expect(res.body.parent.state.stats.ambra).toBeLessThan(98); // Ambra shared, not lost

    const roster = await agent.get('/creatures');
    expect(roster.body.creatures).toHaveLength(2);
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

describe('POST /creatures/:id/archive — endings leave the shelf (STORY.md §7)', () => {
  it('refuses to archive a living light (409)', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const res = await agent.post(`/creatures/${created.body.id}/archive`).set('x-csrf-token', csrf);
    expect(res.status).toBe(409);
  });

  it('lays an ascended light to rest — off the roster, its star kept', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    const created = await agent
      .post('/creatures')
      .set('x-csrf-token', csrf)
      .send({ name: 'Lumen' });
    // Mark it graduated directly (the ceremony normally happens via catch-up).
    const rec = (await ctx.repo.getCreature(created.body.id, userId))!;
    await ctx.repo.saveCreature({ ...rec, graduatedAt: ctx.nowAt() });

    const res = await agent.post(`/creatures/${created.body.id}/archive`).set('x-csrf-token', csrf);
    expect(res.status).toBe(200);
    const listed = await agent.get('/creatures');
    const mine = listed.body.creatures.find((c: { id: string }) => c.id === created.body.id);
    expect(mine.archivedAt).toBe(ctx.nowAt()); // marked, never deleted — the client shelves it
  });

  it('lets a faded light go (dead → archivable), owner-scoped', async () => {
    const ctx = setup();
    const { agent, csrf, userId } = await login(ctx.app);
    const created = await agent
      .post('/creatures')
      .set('x-csrf-token', csrf)
      .send({ name: 'Hollow' });
    const rec = (await ctx.repo.getCreature(created.body.id, userId))!;
    await ctx.repo.saveCreature({ ...rec, state: { ...rec.state, alive: false } });

    // another Light cannot archive it (404, never leaked)
    const other = await login(ctx.app, 'other');
    const crossed = await other.agent
      .post(`/creatures/${created.body.id}/archive`)
      .set('x-csrf-token', other.csrf);
    expect(crossed.status).toBe(404);

    const res = await agent.post(`/creatures/${created.body.id}/archive`).set('x-csrf-token', csrf);
    expect(res.status).toBe(200);
  });
});

describe('rate limits (abuse/cost guards)', () => {
  it('caps Mote creation per account (10/hour) — attempts, not just successes', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    for (let i = 0; i < 10; i++) {
      const res = await agent
        .post('/creatures')
        .set('x-csrf-token', csrf)
        .send({ name: `M${i}` });
      // The shelf (L4) admits three; further attempts are shelf-refused but still count.
      expect(res.status).toBe(i < 3 ? 201 : 403);
    }
    const blocked = await agent
      .post('/creatures')
      .set('x-csrf-token', csrf)
      .send({ name: 'one-more' });
    expect(blocked.status).toBe(429);

    // a DIFFERENT account is unaffected — the limit is per-owner, not global
    const other = await login(app, 'other-light');
    const res = await other.agent
      .post('/creatures')
      .set('x-csrf-token', other.csrf)
      .send({ name: 'Pip' });
    expect(res.status).toBe(201);
  });

  it('caps peeks per account (30/hour) — the ceiling on AI spend once narration is on', async () => {
    const { app } = setup();
    const { agent, csrf } = await login(app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const id = created.body.id as string;
    for (let i = 0; i < 30; i++) {
      expect((await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf)).status).toBe(
        200,
      );
    }
    expect((await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf)).status).toBe(429);
  });
});
