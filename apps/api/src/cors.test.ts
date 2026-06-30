import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { cors } from './cors.js';

function appWithCors(allowedOrigin: string | undefined) {
  const app = express();
  app.use(cors(allowedOrigin));
  app.patch('/me/preferences', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('cors (two-service deploy)', () => {
  it('allows every method a real route uses — PATCH included (regression: /me/preferences)', async () => {
    const app = appWithCors('https://app.example.com');
    const preflight = await request(app)
      .options('/me/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'PATCH');
    expect(preflight.status).toBe(204);
    const allowed = preflight.headers['access-control-allow-methods'] ?? '';
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      expect(allowed).toContain(method);
    }
  });

  it('is a no-op for a single-origin deploy (no allowed origin configured)', async () => {
    const app = appWithCors(undefined);
    const res = await request(app)
      .patch('/me/preferences')
      .set('Origin', 'https://anything.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
