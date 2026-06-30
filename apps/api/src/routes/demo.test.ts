import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

function setup(seedValue = 42) {
  const app = createApp({
    repo: new InMemoryRepository(),
    clock: () => 1_000_000,
    seed: () => seedValue,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
  });
  return app;
}

describe('the pre-signup birth moment (GET /demo/birth)', () => {
  it('hands a logged-out visitor an ephemeral newborn Mote and its first thought', async () => {
    const res = await request(setup(42)).get('/demo/birth'); // no session, no CSRF
    expect(res.status).toBe(200);
    expect(res.body.creature.state.stage).toBe('mote');
    expect(res.body.creature.state.seed).toBe(42);
    expect(typeof res.body.thought).toBe('string');
    expect(res.body.thought.length).toBeGreaterThan(0);
    expect(res.body.seed).toBe(42); // returned so the client can keep this very one
  });

  it('stores nothing — it is purely ephemeral', async () => {
    const app = setup();
    await request(app).get('/demo/birth');
    // a fresh visitor still cannot list creatures without an account
    const listed = await request(app).get('/creatures');
    expect(listed.status).toBe(401);
  });

  it('rate-limits a scripted hammer (30/min per IP)', async () => {
    const app = setup();
    for (let i = 0; i < 30; i++) {
      expect((await request(app).get('/demo/birth')).status).toBe(200);
    }
    expect((await request(app).get('/demo/birth')).status).toBe(429);
  });
});
