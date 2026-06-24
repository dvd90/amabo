import { MAX_MEMORIES } from '@amabo/ai';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.js';
import { FakeAuthProvider } from './auth/provider.js';
import type { Narrator } from './narrate/port.js';
import { InMemoryRepository } from './repo/memory.js';

async function login(app: Express) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google');
  const state = new URL(start.headers.location!).searchParams.get('state') ?? '';
  await agent.get('/auth/callback').query({ code: 'pip', state });
  const me = await agent.get('/me');
  return { agent, csrf: me.body.csrfToken as string, userId: me.body.user.id as string };
}

describe('memory distillation flow (M7)', () => {
  it('sends only the top-N memories to the narrator and persists new ones', async () => {
    const repo = new InMemoryRepository();
    let received: { text: string; salience: number }[] | undefined;

    const narrator: Narrator = {
      async narrate(ctx) {
        received = ctx.memories;
        return {
          journal: 'a line',
          mood: 'calm',
          newMemories: [{ text: 'a new thing', salience: 9 }],
        };
      },
    };

    const app = createApp({
      repo,
      clock: () => 1_000_000,
      seed: () => 1,
      narrator,
      authProvider: new FakeAuthProvider(),
      cookieSecure: false,
      baseUrl: 'http://localhost',
    });

    const { agent, csrf, userId } = await login(app);
    const created = await agent.post('/creatures').set('x-csrf-token', csrf).send({ name: 'Pip' });
    const id = created.body.id;

    // Bank far more memories than the cap.
    await repo.addMemories(
      id,
      Array.from({ length: 100 }, (_, i) => ({ at: i, text: `m${i}`, salience: i })),
    );

    await agent.post(`/creatures/${id}/peek`).set('x-csrf-token', csrf).send({});

    expect(received).toBeDefined();
    expect(received!.length).toBeLessThanOrEqual(MAX_MEMORIES);
    // The new memory emitted by the narrator was persisted (now 101 in store).
    const all = await repo.topMemories(id, 1000);
    expect(all).toHaveLength(101);
    expect(all.some((m) => m.text === 'a new thing')).toBe(true);
    expect(userId).toBeTruthy();
  });
});
