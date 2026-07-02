import { describe, expect, it, vi } from 'vitest';
import type { SimEvent } from '@amabo/engine';
import { InMemoryRepository } from '../repo/memory.js';
import { meteredNarrator } from './metered.js';
import type { NarrateContext, Narrator } from './port.js';

const DAY = 24 * 60 * 60 * 1000;

function modelNarrator(): Narrator {
  return {
    narrate: vi.fn().mockResolvedValue({
      journal: 'a model-written day',
      mood: 'content',
      usage: { inputTokens: 900, outputTokens: 120 },
    }),
  };
}
const local: Narrator = {
  narrate: async () => ({ journal: 'a templated day', mood: 'calm' }),
};

function ctx(ownerId: string): NarrateContext {
  return { name: 'Pip', ownerId, state: { asleep: false } as NarrateContext['state'] };
}
const noEvents: SimEvent[] = [];

function setup(over: { userAllowancePerDay?: number; globalCallsPerDay?: number } = {}) {
  const repo = new InMemoryRepository();
  let now = 1_000_000;
  const capture = vi.fn();
  const model = modelNarrator();
  const narrator = meteredNarrator(model, local, {
    repo,
    clock: () => now,
    monitor: { capture },
    userAllowancePerDay: over.userAllowancePerDay ?? 3,
    globalCallsPerDay: over.globalCallsPerDay ?? 100,
  });
  return { repo, narrator, model, capture, tick: (ms: number) => (now += ms) };
}

describe('the metered narrator (L3) — the soul, with a sensible bill', () => {
  it('uses the model within allowance and writes the cost ledger', async () => {
    const { repo, narrator } = setup();
    const out = await narrator.narrate(ctx('u1'), noEvents, 'peek');
    expect(out.journal).toBe('a model-written day');
    expect(await repo.countTelemetry('narration', { since: 0, userId: 'u1' })).toBe(1);
  });

  it('over the daily allowance the voice degrades gracefully — and returns tomorrow', async () => {
    const { repo, narrator, tick } = setup({ userAllowancePerDay: 2 });
    await narrator.narrate(ctx('u1'), noEvents, 'peek');
    await narrator.narrate(ctx('u1'), noEvents, 'peek');
    const third = await narrator.narrate(ctx('u1'), noEvents, 'peek');
    expect(third.journal).toBe('a templated day'); // silently local, never an error
    expect(await repo.countTelemetry('narration', { since: 0, userId: 'u1' })).toBe(2);

    // Another Light is unaffected…
    const other = await narrator.narrate(ctx('u2'), noEvents, 'peek');
    expect(other.journal).toBe('a model-written day');

    // …and the first is welcome again once the window rolls past.
    tick(DAY + 1);
    const tomorrow = await narrator.narrate(ctx('u1'), noEvents, 'peek');
    expect(tomorrow.journal).toBe('a model-written day');
  });

  it('the global breaker stops ALL model spend and raises one alarm', async () => {
    const { narrator, capture } = setup({ globalCallsPerDay: 2, userAllowancePerDay: 99 });
    await narrator.narrate(ctx('u1'), noEvents, 'peek');
    await narrator.narrate(ctx('u2'), noEvents, 'peek');
    const tripped = await narrator.narrate(ctx('u3'), noEvents, 'peek');
    expect(tripped.journal).toBe('a templated day');
    expect(capture).toHaveBeenCalledTimes(1); // one alarm, not one per request
    await narrator.narrate(ctx('u4'), noEvents, 'peek');
    expect(capture).toHaveBeenCalledTimes(1);
  });
});

// Route-level acceptance: a real peek flows through the meter with its Light attached.
import request from 'supertest';
import { createApp } from '../app.js';
import { FakeAuthProvider } from '../auth/provider.js';

describe('peek → meter (L3, end to end)', () => {
  it('the 2nd peek of a 1/day allowance falls back to the local voice, without error', async () => {
    const repo = new InMemoryRepository();
    const model = modelNarrator();
    const app = createApp({
      repo,
      clock: () => 1_000_000,
      seed: () => 1,
      narrator: meteredNarrator(model, local, {
        repo,
        clock: () => 1_000_000,
        monitor: { capture: vi.fn() },
        userAllowancePerDay: 1,
        globalCallsPerDay: 100,
      }),
      authProvider: new FakeAuthProvider(),
      cookieSecure: false,
      baseUrl: 'http://localhost',
    });
    const agent = request.agent(app);
    const start = await agent.get('/auth/google');
    const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
    await agent.get('/auth/callback').query({ code: 'light', state });
    const me = await agent.get('/me');
    const csrf = me.body.csrfToken as string;
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });

    const first = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(first.body.journal).toBe('a model-written day');

    const second = await agent
      .post(`/creatures/${created.body.id}/peek`)
      .set('x-csrf-token', csrf)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.journal).toBe('a templated day');
    // The ledger holds exactly the one model call, charged to this Light.
    expect(await repo.countTelemetry('narration', { since: 0, userId: me.body.user.id })).toBe(1);
  });
});
