import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { FakeAuthProvider, type OAuthProfile } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

/** Like production sign-in: the provider vouches for identity, never for age. */
class AgelessProvider extends FakeAuthProvider {
  override async exchange(code: string): Promise<OAuthProfile> {
    const profile = await super.exchange(code);
    return { ...profile, ageBand: undefined };
  }
}

function setup(ageless = false) {
  const repo = new InMemoryRepository();
  const app = createApp({
    repo,
    clock: () => 1_000_000,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: ageless ? new AgelessProvider() : new FakeAuthProvider(),
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
  return {
    agent,
    csrf: me.body.csrfToken as string,
    userId: me.body.user.id as string,
    email: me.body.user.email as string,
  };
}

describe('the age gate (L2) — 13+ and meant', () => {
  it('blocks condensing a creature until the age is confirmed', async () => {
    const { app } = setup(true);
    const u = await login(app, 'young');
    const refused = await u.agent
      .post('/creatures')
      .set('x-csrf-token', u.csrf)
      .send({ name: 'Pip' });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatch(/age/);

    const set = await u.agent.post('/me/age').set('x-csrf-token', u.csrf).send({ band: '13-17' });
    expect(set.status).toBe(200);
    expect((await u.agent.get('/me')).body.user.ageBand).toBe('13-17');

    const ok = await u.agent.post('/creatures').set('x-csrf-token', u.csrf).send({ name: 'Pip' });
    expect(ok.status).toBe(201);
  });

  it('accepts only the two honest bands', async () => {
    const { app } = setup();
    const u = await login(app, 'x');
    const bad = await u.agent.post('/me/age').set('x-csrf-token', u.csrf).send({ band: '5-12' });
    expect(bad.status).toBe(400);
    const adult = await u.agent.post('/me/age').set('x-csrf-token', u.csrf).send({ band: '18+' });
    expect(adult.status).toBe(200);
  });
});

describe('account deletion (L2) — the right to be forgotten', () => {
  it('erases every owner-scoped row and ends the session', async () => {
    const { repo, app } = setup();
    const u = await login(app, 'leaver');
    await u.agent.post('/me/age').set('x-csrf-token', u.csrf).send({ band: '18+' });
    const created = await u.agent
      .post('/creatures')
      .set('x-csrf-token', u.csrf)
      .send({ name: 'Pip' });
    const creatureId = created.body.id as string;

    // The confirm phrase must match the account email — no accidental goodbyes.
    const wrong = await u.agent
      .delete('/me')
      .set('x-csrf-token', u.csrf)
      .send({ confirm: 'not-my-email' });
    expect(wrong.status).toBe(400);

    const gone = await u.agent.delete('/me').set('x-csrf-token', u.csrf).send({ confirm: u.email });
    expect(gone.status).toBe(204);

    // Session over; the creature is unreachable even to a fresh session of the same human.
    expect((await u.agent.get('/me')).status).toBe(401);
    expect(await repo.getCreature(creatureId, u.userId)).toBeNull();

    // Signing in again with the same provider account starts a brand-new, empty Light.
    const again = await login(app, 'leaver');
    expect(again.userId).not.toBe(u.userId);
    expect((await again.agent.get('/creatures')).body.creatures).toHaveLength(0);
  });
});
