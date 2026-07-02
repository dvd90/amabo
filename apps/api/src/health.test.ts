import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { FakeAuthProvider } from './auth/provider.js';
import { localNarrator } from './narrate/port.js';
import { InMemoryRepository } from './repo/memory.js';

function setup(version?: string) {
  return createApp({
    repo: new InMemoryRepository(),
    clock: () => 1_000_000,
    seed: () => 1,
    narrator: localNarrator,
    authProvider: new FakeAuthProvider(),
    cookieSecure: false,
    baseUrl: 'http://localhost',
    version,
  });
}

describe('deploy truth (L0)', () => {
  it('/health names the exact build that is running', async () => {
    const res = await request(setup('abc1234deadbeef')).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, version: 'abc1234deadbeef', startedAt: 1_000_000 });
  });

  it('falls back to "dev" when no version is injected (local runs)', async () => {
    const res = await request(setup()).get('/health');
    expect(res.body.version).toBe('dev');
  });
});
