/**
 * index.ts — the composition root. Build dependencies from the environment (12-factor)
 * and start the server. With DATABASE_URL set we use Postgres; without it an in-memory
 * repo for a zero-setup local run. Google OAuth in prod; a fake provider when its
 * secrets are absent (local dev only). The AI narrator lands in M6.
 */

import { makeAnthropicClient } from '@amabo/ai';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { FakeAuthProvider, GoogleAuthProvider, type AuthProvider } from './auth/provider.js';
import { randomSeed, systemClock } from './clock.js';
import { makeDb } from './db/client.js';
import { aiNarrator } from './narrate/ai.js';
import { localNarrator } from './narrate/port.js';
import type { Narrator } from './narrate/port.js';
import { DrizzleRepository } from './repo/drizzle.js';
import { InMemoryRepository } from './repo/memory.js';
import type { Repository } from './repo/types.js';

/** Auto-detect the built PWA for a single-origin deploy (set WEB_DIST to override). */
function webDistDir(): string | undefined {
  const explicit = process.env.WEB_DIST;
  if (explicit) return existsSync(explicit) ? explicit : undefined;
  const guess = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../web/dist');
  return existsSync(guess) ? guess : undefined;
}

function buildNarrator(): Narrator {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return aiNarrator(makeAnthropicClient(key));
  console.warn('[amabo] ANTHROPIC_API_KEY not set — using local templated narrator');
  return localNarrator;
}

function buildRepo(): Repository {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[amabo] DATABASE_URL not set — using in-memory repository (data not persisted)');
    return new InMemoryRepository();
  }
  return new DrizzleRepository(makeDb(url));
}

function buildAuthProvider(): AuthProvider {
  const id = process.env.GOOGLE_OAUTH_ID;
  const secret = process.env.GOOGLE_OAUTH_SECRET;
  if (id && secret) return new GoogleAuthProvider(id, secret);
  console.warn('[amabo] GOOGLE_OAUTH_ID/SECRET not set — using fake auth provider (local only)');
  return new FakeAuthProvider();
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp({
    repo: buildRepo(),
    clock: systemClock,
    seed: randomSeed,
    narrator: buildNarrator(),
    authProvider: buildAuthProvider(),
    cookieSecure: process.env.NODE_ENV === 'production',
    baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
    // Two-service deploy: set WEB_ORIGIN to the web app's URL (enables CORS +
    // SameSite=None cookies + post-login redirect back to the web app).
    webOrigin: process.env.WEB_ORIGIN,
    staticDir: webDistDir(),
  });
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`amabo api listening on :${port}`);
  });
}
