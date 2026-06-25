import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';
import { localNarrator } from '../narrate/port.js';
import { InMemoryRepository } from '../repo/memory.js';

function setup() {
  const repo = new InMemoryRepository();
  let now = 1_000_000;
  const app = createApp({
    repo,
    clock: () => now,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
  });
  return { repo, app, setNow: (t: number) => (now = t) };
}

describe('auth (M5.5)', () => {
  it('completes the OAuth round-trip and establishes a session', async () => {
    const { app } = setup();
    const agent = request.agent(app);

    const start = await agent.get('/auth/google');
    expect(start.status).toBe(302);
    const state = new URL(start.headers.location!).searchParams.get('state');
    expect(state).toBeTruthy();

    const cb = await agent.get('/auth/callback').query({ code: 'pip', state: state ?? '' });
    expect(cb.status).toBe(302);

    const me = await agent.get('/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('pip@example.com');
    expect(me.body.csrfToken).toBeTruthy();
  });

  it('rejects a callback whose state does not match (CSRF on the OAuth flow)', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.get('/auth/google');
    const res = await agent.get('/auth/callback').query({ code: 'pip', state: 'forged' });
    expect(res.status).toBe(400);
  });

  it('email sign-in establishes a session and is idempotent per email', async () => {
    const { app } = setup();
    const agent = request.agent(app);

    const login = await agent.post('/auth/email').send({ email: 'Pip@Example.com' });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('pip@example.com'); // normalised
    expect(login.body.csrfToken).toBeTruthy();

    const me = await agent.get('/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('pip@example.com');

    // Signing in again with the same email returns the same account.
    const again = await request.agent(app).post('/auth/email').send({ email: 'pip@example.com' });
    expect(again.body.user.id).toBe(login.body.user.id);
  });

  it('rejects a malformed email with 400', async () => {
    const { app } = setup();
    const res = await request(app).post('/auth/email').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('does not accept a forged/unknown session cookie', async () => {
    const { app } = setup();
    const res = await request(app).get('/me').set('Cookie', 'amabo_session=not-a-real-session');
    expect(res.status).toBe(401);
  });

  it('logout destroys the session', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    const start = await agent.get('/auth/google');
    const state = new URL(start.headers.location!).searchParams.get('state');
    await agent.get('/auth/callback').query({ code: 'pip', state: state ?? '' });
    const me = await agent.get('/me');

    const out = await agent.post('/auth/logout').set('x-csrf-token', me.body.csrfToken).send({});
    expect(out.status).toBe(200);
    expect((await agent.get('/me')).status).toBe(401);
  });

  it('expired sessions are ignored', async () => {
    const ctx = setup();
    const agent = request.agent(ctx.app);
    const start = await agent.get('/auth/google');
    const state = new URL(start.headers.location!).searchParams.get('state');
    await agent.get('/auth/callback').query({ code: 'pip', state: state ?? '' });
    expect((await agent.get('/me')).status).toBe(200);

    ctx.setNow(1_000_000 + 40 * 24 * 60 * 60 * 1000); // past the 30-day TTL
    expect((await agent.get('/me')).status).toBe(401);
  });
});
