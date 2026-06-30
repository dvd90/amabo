import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
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

  it('email POST does NOT sign you in — it only sends a magic link', async () => {
    const { app } = setup();
    const agent = request.agent(app);

    const sent = await agent.post('/auth/email').send({ email: 'Pip@Example.com' });
    expect(sent.status).toBe(200);
    expect(sent.body.sent).toBe(true);
    expect(sent.body.user).toBeUndefined(); // no account leaked, no session minted
    expect(sent.body.csrfToken).toBeUndefined();
    expect((await agent.get('/me')).status).toBe(401); // still signed out

    // The link normalises the address; following it establishes the session.
    expect(sent.body.devLink).toContain('/auth/email/callback?token=');
    const link = new URL(sent.body.devLink);
    const cb = await agent.get(link.pathname + link.search);
    expect(cb.status).toBe(302);
    const me = await agent.get('/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('pip@example.com'); // normalised
  });

  it('is idempotent per email — the same address always lands in the same account', async () => {
    const { app } = setup();
    const follow = async (email: string) => {
      const agent = request.agent(app);
      const sent = await agent.post('/auth/email').send({ email });
      const link = new URL(sent.body.devLink);
      await agent.get(link.pathname + link.search);
      return (await agent.get('/me')).body.user.id as string;
    };
    expect(await follow('pip@example.com')).toBe(await follow('PIP@example.com'));
  });

  it('merges a Google sign-in and a later magic-link sign-in to the SAME email into one account', async () => {
    const { app } = setup();

    // First, sign in with the fake OAuth provider (stands in for Google) as pip@example.com.
    const oauth = request.agent(app);
    const start = await oauth.get('/auth/google');
    const state = new URL(start.headers.location!).searchParams.get('state');
    await oauth.get('/auth/callback').query({ code: 'pip', state: state ?? '' });
    const oauthMe = await oauth.get('/me');
    const oauthUserId = oauthMe.body.user.id as string;

    // Condense a creature under that account.
    const created = await oauth
      .post('/creatures')
      .set('x-csrf-token', oauthMe.body.csrfToken)
      .send({ name: 'Pip' });
    expect(created.status).toBe(201);

    // Now, on a different device/agent, request a magic link to the SAME email and follow
    // it. This must land in the SAME account — not spawn a duplicate.
    const viaEmail = request.agent(app);
    const sent = await viaEmail.post('/auth/email').send({ email: 'pip@example.com' });
    const link = new URL(sent.body.devLink);
    await viaEmail.get(link.pathname + link.search);
    const emailMe = await viaEmail.get('/me');

    expect(emailMe.status).toBe(200);
    expect(emailMe.body.user.id).toBe(oauthUserId); // merged, not duplicated

    // And the creature condensed under the OAuth sign-in is visible from this one too.
    const listed = await viaEmail.get('/creatures');
    expect(listed.body.creatures.map((c: { name: string }) => c.name)).toContain('Pip');
  });

  it('merges in the other order too: magic-link first, then a Google sign-in to the same email', async () => {
    const { app } = setup();

    const viaEmail = request.agent(app);
    const sent = await viaEmail.post('/auth/email').send({ email: 'sol@example.com' });
    const link = new URL(sent.body.devLink);
    await viaEmail.get(link.pathname + link.search);
    const emailUserId = (await viaEmail.get('/me')).body.user.id as string;

    const oauth = request.agent(app);
    const start = await oauth.get('/auth/google');
    const state = new URL(start.headers.location!).searchParams.get('state');
    // FakeAuthProvider derives the email as `${code}@example.com` — use 'sol' to match.
    await oauth.get('/auth/callback').query({ code: 'sol', state: state ?? '' });
    const oauthUserId = (await oauth.get('/me')).body.user.id as string;

    expect(oauthUserId).toBe(emailUserId);
  });

  it('rejects a tampered or expired magic link (no session)', async () => {
    const { app, setNow } = setup();
    const agent = request.agent(app);
    const sent = await agent.post('/auth/email').send({ email: 'pip@example.com' });
    const link = new URL(sent.body.devLink);

    // tampered token → bounced to login flagged, not signed in
    const forged = await agent.get(`${link.pathname}?token=not.a.valid.token`);
    expect(forged.status).toBe(302);
    expect(forged.headers.location).toContain('auth_error=link');
    expect((await agent.get('/me')).status).toBe(401);

    // valid token but past its 15-minute window → rejected
    setNow(1_000_000 + 16 * 60 * 1000);
    const expired = await agent.get(link.pathname + link.search);
    expect(expired.status).toBe(302);
    expect(expired.headers.location).toContain('auth_error=link');
    expect((await agent.get('/me')).status).toBe(401);
  });

  it('rate-limits magic-link requests (mail-bomb guard)', async () => {
    const { app } = setup();
    // The limit is 5 per 15 minutes per IP; all of supertest's requests share one IP.
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/email')
        .send({ email: `p${i}@example.com` });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post('/auth/email').send({ email: 'one-too-many@x.com' });
    expect(blocked.status).toBe(429);
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

  describe('appearance preferences (account-level, follow any device)', () => {
    async function signIn(app: Express) {
      const agent = request.agent(app);
      const start = await agent.get('/auth/google');
      const state = new URL(start.headers.location!).searchParams.get('state');
      await agent.get('/auth/callback').query({ code: 'pip', state: state ?? '' });
      const me = await agent.get('/me');
      return { agent, csrf: me.body.csrfToken as string };
    }

    it('a fresh account has no preferences yet', async () => {
      const { app } = setup();
      const { agent } = await signIn(app);
      expect((await agent.get('/me')).body.user.preferences).toEqual({});
    });

    it('saves a merge-patch and a later /me reflects it', async () => {
      const { app } = setup();
      const { agent, csrf } = await signIn(app);

      const r1 = await agent
        .patch('/me/preferences')
        .set('x-csrf-token', csrf)
        .send({ theme: 'solar' });
      expect(r1.status).toBe(200);
      expect(r1.body.preferences).toEqual({ theme: 'solar' });

      // A second patch with a different key doesn't clobber the first.
      const r2 = await agent
        .patch('/me/preferences')
        .set('x-csrf-token', csrf)
        .send({ pixelMode: true });
      expect(r2.body.preferences).toEqual({ theme: 'solar', pixelMode: true });

      expect((await agent.get('/me')).body.user.preferences).toEqual({
        theme: 'solar',
        pixelMode: true,
      });
    });

    it('requires auth and a valid CSRF token', async () => {
      const { app } = setup();
      const anon = await request(app).patch('/me/preferences').send({ theme: 'solar' });
      expect(anon.status).toBe(401);

      const { agent } = await signIn(app);
      const noCsrf = await agent.patch('/me/preferences').send({ theme: 'solar' });
      expect(noCsrf.status).toBe(403);
    });

    it('rejects a malformed body', async () => {
      const { app } = setup();
      const { agent, csrf } = await signIn(app);
      const res = await agent
        .patch('/me/preferences')
        .set('x-csrf-token', csrf)
        .send({ pixelMode: 'not-a-boolean' });
      expect(res.status).toBe(400);
    });
  });
});
