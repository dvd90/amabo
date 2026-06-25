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

  it('a callback whose state does not match bounces back to login flagged (no session)', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.get('/auth/google');
    const res = await agent.get('/auth/callback').query({ code: 'pip', state: 'forged' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('auth_error=state');
    expect((await agent.get('/me')).status).toBe(401); // and we are NOT signed in
  });

  it('advertises available sign-in methods via /auth/config', async () => {
    const { app } = setup();
    const res = await request(app).get('/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(true);
    expect(res.body.google).toBe(false); // fake provider → Google button hidden
  });

  it('honours GOOGLE_CALLBACK_URL and serves the callback at /auth/google/callback', async () => {
    const repo = new InMemoryRepository();
    const app = createApp({
      repo,
      clock: () => 1_000_000,
      seed: () => 1,
      narrator: localNarrator,
      authProvider: new FakeAuthProvider(),
      cookieSecure: false,
      baseUrl: 'http://localhost',
      googleEnabled: true,
      googleCallbackUrl: 'http://localhost/auth/google/callback',
    });
    expect((await request(app).get('/auth/config')).body.google).toBe(true);

    const agent = request.agent(app);
    const start = await agent.get('/auth/google');
    // The pinned redirect_uri is what we send the provider (and register in the console).
    expect(start.headers.location).toContain('/auth/google/callback');
    const state = new URL(start.headers.location!).searchParams.get('state') ?? '';

    const cb = await agent.get('/auth/google/callback').query({ code: 'pip', state });
    expect(cb.status).toBe(302);
    expect((await agent.get('/me')).body.user.email).toBe('pip@example.com');
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
