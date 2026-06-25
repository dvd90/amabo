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

async function login(app: Express, code: string) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code, state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

async function makeCreature(app: Express) {
  const u = await login(app, 'host');
  const created = await u.agent
    .post('/creatures')
    .set('x-csrf-token', u.csrf)
    .send({ name: 'Pip' });
  return { ...u, id: created.body.id as string };
}

describe('rehoming by email + accept inbox (M-K)', () => {
  it('entrusts a creature to another Light, who accepts and gains ownership', async () => {
    const { app } = setup();
    const alice = await login(app, 'alice');
    const created = await alice.agent
      .post('/creatures')
      .set('x-csrf-token', alice.csrf)
      .send({ name: 'Pip' });

    // Bob signs in so his account (bob@example.com) exists to receive the creature.
    const bob = await login(app, 'bob');
    const bobEmail = (await bob.agent.get('/me')).body.user.email as string;

    // Alice entrusts Pip to Bob by email.
    const sent = await alice.agent
      .post(`/creatures/${created.body.id}/rehome`)
      .set('x-csrf-token', alice.csrf)
      .send({ toEmail: bobEmail });
    expect(sent.status).toBe(201);

    // It shows up in Bob's inbox…
    const inbox = await bob.agent.get('/rehomes/incoming');
    expect(inbox.body.incoming).toHaveLength(1);
    expect(inbox.body.incoming[0].creatureName).toBe('Pip');

    // …Bob accepts, and Pip is now in Bob's roster (and gone from Alice's).
    await bob.agent
      .post(`/rehome/${inbox.body.incoming[0].id}/confirm`)
      .set('x-csrf-token', bob.csrf)
      .send({});
    expect(
      (await bob.agent.get('/creatures')).body.creatures.map((c: { name: string }) => c.name),
    ).toContain('Pip');
    expect((await alice.agent.get('/creatures')).body.creatures).toHaveLength(0);
  });

  it('rejects an unknown recipient email (404)', async () => {
    const { app } = setup();
    const alice = await login(app, 'alice');
    const created = await alice.agent
      .post('/creatures')
      .set('x-csrf-token', alice.csrf)
      .send({ name: 'Pip' });
    const res = await alice.agent
      .post(`/creatures/${created.body.id}/rehome`)
      .set('x-csrf-token', alice.csrf)
      .send({ toEmail: 'nobody@nowhere.test' });
    expect(res.status).toBe(404);
  });
});

describe('share links open the web viewer (M-J)', () => {
  it('mints a postcard link pointing at /look/:token', async () => {
    const { app } = setup();
    const host = await makeCreature(app);
    const share = await host.agent
      .post(`/creatures/${host.id}/share`)
      .set('x-csrf-token', host.csrf)
      .send({ kind: 'postcard' });
    expect(share.status).toBe(201);
    expect(share.body.url).toContain(`/look/${share.body.token}`);
  });
});

describe('meetings between your own creatures (M-H)', () => {
  it('two of your creatures resonate and both keep a shared line', async () => {
    const { app } = setup();
    const u = await login(app, 'host');
    const a = await u.agent.post('/creatures').set('x-csrf-token', u.csrf).send({ name: 'Pip' });
    const b = await u.agent.post('/creatures').set('x-csrf-token', u.csrf).send({ name: 'Bo' });

    const meet = await u.agent
      .post(`/creatures/${a.body.id}/meet/${b.body.id}`)
      .set('x-csrf-token', u.csrf)
      .send({});
    expect(meet.status).toBe(200);
    expect(['harmony', 'clash']).toContain(meet.body.result);
    expect(meet.body.names).toEqual(['Pip', 'Bo']);
  });

  it('a creature cannot meet itself (400)', async () => {
    const { app } = setup();
    const u = await login(app, 'host');
    const a = await u.agent.post('/creatures').set('x-csrf-token', u.csrf).send({ name: 'Pip' });
    const res = await u.agent
      .post(`/creatures/${a.body.id}/meet/${a.body.id}`)
      .set('x-csrf-token', u.csrf)
      .send({});
    expect(res.status).toBe(400);
  });

  it("cannot meet another owner's creature (404, no leak)", async () => {
    const { app } = setup();
    const alice = await login(app, 'alice');
    const a = await alice.agent
      .post('/creatures')
      .set('x-csrf-token', alice.csrf)
      .send({ name: 'Pip' });
    const bob = await login(app, 'bob');
    const b = await bob.agent.post('/creatures').set('x-csrf-token', bob.csrf).send({ name: 'Bo' });
    const res = await alice.agent
      .post(`/creatures/${a.body.id}/meet/${b.body.id}`)
      .set('x-csrf-token', alice.csrf)
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('visits (M9.5)', () => {
  it('a visit link warms the creature and can be revoked', async () => {
    const { app } = setup();
    const host = await makeCreature(app);
    const before = (await host.agent.get(`/creatures/${host.id}`)).body.state.stats.affection;

    const share = await host.agent
      .post(`/creatures/${host.id}/share`)
      .set('x-csrf-token', host.csrf)
      .send({ kind: 'visit' });
    const token = share.body.token;

    // A guest (no session) can visit and leave a kind word.
    const visit = await request(app).post(`/visit/${token}`).send({ word: 'I see you.' });
    expect(visit.status).toBe(200);
    expect(visit.body.warmed).toBe(true);

    const after = (await host.agent.get(`/creatures/${host.id}`)).body.state.stats.affection;
    expect(after).toBeGreaterThan(before);

    // Revoke, then the link is dead.
    await host.agent.delete(`/share/${token}`).set('x-csrf-token', host.csrf);
    expect((await request(app).post(`/visit/${token}`).send({})).status).toBe(404);
  });

  it('a guest cannot mutate the host creature directly (no session)', async () => {
    const { app } = setup();
    const host = await makeCreature(app);
    const res = await request(app).post(`/creatures/${host.id}/interact`).send({ action: 'feed' });
    expect(res.status).toBe(401);
  });
});

describe('resonance meetings (M9.5)', () => {
  it('two creatures meet via a meet token and both come away changed', async () => {
    const { app, repo } = setup();
    const host = await makeCreature(app);
    const guest = await login(app, 'guest');
    const guestCreature = await guest.agent
      .post('/creatures')
      .set('x-csrf-token', guest.csrf)
      .send({ name: 'Bel' });

    // Guest mints a meet token for their creature; host meets it.
    const meet = await guest.agent
      .post(`/creatures/${guestCreature.body.id}/share`)
      .set('x-csrf-token', guest.csrf)
      .send({ kind: 'meet' });

    const res = await host.agent
      .post(`/creatures/${host.id}/meet`)
      .set('x-csrf-token', host.csrf)
      .send({ token: meet.body.token });
    expect(res.status).toBe(200);
    expect(['harmony', 'clash']).toContain(res.body.result);

    // Both creatures recorded a shared resonance beat.
    const hostJournal = await repo.listJournal(host.id, 50, 0);
    expect(hostJournal.some((e) => e.kind === 'resonance')).toBe(true);
  });
});

describe('rehoming (M9.5)', () => {
  it('moves ownership only after BOTH sides confirm, and audits it', async () => {
    const { app, repo } = setup();
    const host = await makeCreature(app);
    const recipient = await login(app, 'recipient');

    expect(recipient.userId).toBeTruthy(); // recipient must exist to receive
    const initiate = await host.agent
      .post(`/creatures/${host.id}/rehome`)
      .set('x-csrf-token', host.csrf)
      .send({ toEmail: 'recipient@example.com' });
    const rehomeId = initiate.body.rehome.id;
    expect(initiate.body.rehome.status).toBe('pending');

    // Still the host's until the recipient confirms.
    expect((await recipient.agent.get(`/creatures/${host.id}`)).status).toBe(404);

    const confirm = await recipient.agent
      .post(`/rehome/${rehomeId}/confirm`)
      .set('x-csrf-token', recipient.csrf)
      .send({});
    expect(confirm.body.rehome.status).toBe('completed');

    // Ownership has moved: recipient can read it, the original owner cannot.
    expect((await recipient.agent.get(`/creatures/${host.id}`)).status).toBe(200);
    expect((await host.agent.get(`/creatures/${host.id}`)).status).toBe(404);

    const audit = await repo.getRehome(rehomeId);
    expect(audit?.fromConfirmedAt).toBeTruthy();
    expect(audit?.toConfirmedAt).toBeTruthy();
  });
});

describe('postcards & safety (M9.5)', () => {
  it('a postcard is public and exposes no account data', async () => {
    const { app } = setup();
    const host = await makeCreature(app);
    const share = await host.agent
      .post(`/creatures/${host.id}/share`)
      .set('x-csrf-token', host.csrf)
      .send({ kind: 'postcard' });
    const res = await request(app).get(`/postcard/${share.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Pip');
    expect(res.body.ownerId).toBeUndefined();
    expect(res.body.email).toBeUndefined();
  });

  it('report and block are accepted for a signed-in user', async () => {
    const { app } = setup();
    const u = await login(app, 'reporter');
    expect(
      (
        await u.agent
          .post('/report')
          .set('x-csrf-token', u.csrf)
          .send({ subject: 'x', reason: 'spam' })
      ).status,
    ).toBe(201);
    expect(
      (await u.agent.post('/block').set('x-csrf-token', u.csrf).send({ blockedUserId: 'someone' }))
        .status,
    ).toBe(201);
  });
});
