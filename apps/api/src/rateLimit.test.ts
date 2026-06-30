import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimit } from './rateLimit.js';

function appWith(max: number, windowMs: number, now: () => number) {
  const app = express();
  app.get('/x', rateLimit({ max, windowMs, keyOf: () => 'fixed-key', clock: now }), (_req, res) =>
    res.json({ ok: true }),
  );
  return app;
}

describe('rateLimit', () => {
  it('allows up to max requests in the window, then 429s', async () => {
    const now = 0;
    const app = appWith(3, 1000, () => now);
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/x')).status).toBe(200);
    }
    const blocked = await request(app).get('/x');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBeTruthy();
  });

  it('allows again once the window has rolled past the old hits', async () => {
    let now = 0;
    const app = appWith(2, 1000, () => now);
    await request(app).get('/x');
    await request(app).get('/x');
    expect((await request(app).get('/x')).status).toBe(429);

    now += 1001; // the old hits are now outside the window
    expect((await request(app).get('/x')).status).toBe(200);
  });

  it('tracks separate keys independently', async () => {
    const now = 0;
    let key = 'a';
    const app = express();
    app.get(
      '/x',
      rateLimit({ max: 1, windowMs: 1000, keyOf: () => key, clock: () => now }),
      (_req, res) => res.json({ ok: true }),
    );
    expect((await request(app).get('/x')).status).toBe(200);
    expect((await request(app).get('/x')).status).toBe(429); // 'a' is now blocked

    key = 'b';
    expect((await request(app).get('/x')).status).toBe(200); // a different key, fresh budget
  });
});
