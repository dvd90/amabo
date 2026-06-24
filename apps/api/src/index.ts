/**
 * index.ts — the composition root. Build dependencies from the environment (12-factor)
 * and start the server. With DATABASE_URL set we use Postgres; without it we fall back
 * to an in-memory repo for a zero-setup local run. The AI narrator lands in M6; M5
 * ships the local fallback so `peek` always returns a line.
 */

import { createApp } from './app.js';
import { randomSeed, systemClock } from './clock.js';
import { makeDb } from './db/client.js';
import { localNarrator } from './narrate/port.js';
import { DrizzleRepository } from './repo/drizzle.js';
import { InMemoryRepository } from './repo/memory.js';
import type { Repository } from './repo/types.js';

function buildRepo(): Repository {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[amabo] DATABASE_URL not set — using in-memory repository (data not persisted)');
    return new InMemoryRepository();
  }
  return new DrizzleRepository(makeDb(url));
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp({
    repo: buildRepo(),
    clock: systemClock,
    seed: randomSeed,
    narrator: localNarrator,
    getOwner: () => null, // single-user until M5.5 wires sessions
  });
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`amabo api listening on :${port}`);
  });
}
