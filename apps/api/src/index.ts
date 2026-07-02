/**
 * index.ts — the composition root. Build dependencies from the environment (12-factor)
 * and start the server. With DATABASE_URL set we use Postgres; without it an in-memory
 * repo for a zero-setup local run. Google OAuth in prod; a fake provider when its
 * secrets are absent (local dev only). The AI narrator lands in M6.
 */

import { makeAnthropicClient } from '@amabo/ai';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { nullMonitor, sentryMonitor, type Monitor } from './monitor.js';
import { FakeAuthProvider, GoogleAuthProvider, type AuthProvider } from './auth/provider.js';
import { consoleMailer, resendMailer, type Mailer } from './auth/mailer.js';
import { randomSeed, systemClock } from './clock.js';
import { makeDb } from './db/client.js';
import { aiNarrator } from './narrate/ai.js';
import { meteredNarrator } from './narrate/metered.js';
import { localNarrator } from './narrate/port.js';
import type { Narrator } from './narrate/port.js';
import { localSymposiumNarrator, type SymposiumNarrator } from './narrate/symposium.js';
import { aiSymposiumNarrator } from './narrate/symposium-ai.js';
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

function buildNarrator(repo: Repository, monitor: Monitor): Narrator {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.warn('[amabo] ANTHROPIC_API_KEY not set — using local templated narrator');
    return localNarrator;
  }
  // The soul, with a sensible bill (L3): allowance + breaker + ledger around the model.
  return meteredNarrator(aiNarrator(makeAnthropicClient(key)), localNarrator, {
    repo,
    clock: systemClock,
    monitor,
    userAllowancePerDay: Number(process.env.NARRATION_USER_ALLOWANCE ?? 10),
    globalCallsPerDay: Number(process.env.NARRATION_DAILY_CAP ?? 2000),
  });
}

/** The Symposium voice: AI when a key is set (with a local fallback), else local. */
function buildSymposiumNarrator(): SymposiumNarrator {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) return aiSymposiumNarrator(makeAnthropicClient(key), localSymposiumNarrator);
  return localSymposiumNarrator;
}

function buildRepo(): Repository {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[amabo] DATABASE_URL not set — using in-memory repository (data not persisted)');
    return new InMemoryRepository();
  }
  return new DrizzleRepository(makeDb(url));
}

/** Read Google creds under either common name pair (OAUTH_* or CLIENT_*). */
function googleCreds(): { id?: string; secret?: string } {
  return {
    id: process.env.GOOGLE_OAUTH_ID ?? process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_OAUTH_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
  };
}

function googleConfigured(): boolean {
  const { id, secret } = googleCreds();
  return Boolean(id && secret);
}

/** Email delivery for magic links. Real provider when configured, else log to console. */
function buildMailer(): { mailer: Mailer; real: boolean } {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (key && from) {
    console.log(`[amabo] magic-link email via Resend (from: ${from})`);
    return { mailer: resendMailer(key, from), real: true };
  }
  console.warn(
    '[amabo] no email provider configured (set RESEND_API_KEY + MAIL_FROM) — magic-link emails will only be logged to the server console',
  );
  return { mailer: consoleMailer, real: false };
}

/** The secret that signs magic-link tokens. Stable across restarts only if AUTH_SECRET is set. */
function magicSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (s) return s;
  console.warn(
    '[amabo] AUTH_SECRET not set — magic-link tokens use a random per-boot secret (links break on restart). Set AUTH_SECRET in production.',
  );
  return randomBytes(32).toString('hex');
}

function buildAuthProvider(): AuthProvider {
  const { id, secret } = googleCreds();
  if (id && secret) return new GoogleAuthProvider(id, secret);
  console.warn(
    '[amabo] Google creds not set (GOOGLE_CLIENT_ID/SECRET or GOOGLE_OAUTH_ID/SECRET) — using fake auth provider (local only)',
  );
  return new FakeAuthProvider();
}

if (process.env.NODE_ENV !== 'test') {
  const webOrigin = process.env.WEB_ORIGIN;
  // Cross-site cookies (SameSite=None, used when WEB_ORIGIN is set) are REJECTED by
  // browsers unless also Secure — so force Secure in that case even if NODE_ENV wasn't
  // set. Railway is always HTTPS. This prevents a silent "logged out forever" failure.
  const cookieSecure = process.env.NODE_ENV === 'production' || Boolean(webOrigin);
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

  // Print the exact OAuth redirect URI so it can be copied verbatim into the Google
  // console's "Authorized redirect URIs" — the cure for `redirect_uri_mismatch`.
  if (googleConfigured()) {
    const cb = process.env.GOOGLE_CALLBACK_URL ?? `${baseUrl}/auth/callback`;
    console.log(
      `[amabo] Google OAuth enabled. Register this EXACT redirect URI in the Google console:\n         ${cb}`,
    );
  }

  const { mailer, real: realMailer } = buildMailer();

  const repo = buildRepo();
  const monitor = process.env.SENTRY_DSN
    ? sentryMonitor(
        process.env.SENTRY_DSN,
        process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.AMABO_VERSION ?? 'dev',
      )
    : nullMonitor;

  const app = createApp({
    repo,
    clock: systemClock,
    seed: randomSeed,
    narrator: buildNarrator(repo, monitor),
    symposiumNarrator: buildSymposiumNarrator(),
    authProvider: buildAuthProvider(),
    mailer,
    magicSecret: magicSecret(),
    // Echo the link in the response ONLY in local dev with no real mailer. Never in prod:
    // a public link-for-any-email would re-open the hole.
    magicDevEcho: process.env.NODE_ENV !== 'production' && !realMailer,
    cookieSecure,
    baseUrl,
    // Two-service deploy: set WEB_ORIGIN to the web app's URL (enables CORS +
    // SameSite=None cookies + post-login redirect back to the web app).
    webOrigin,
    staticDir: webDistDir(),
    googleEnabled: googleConfigured(),
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    // Railway injects the commit SHA; AMABO_VERSION covers other hosts.
    version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.AMABO_VERSION,
    // Error eyes (L1): a no-op unless SENTRY_DSN is set.
    monitor,
  });
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`amabo api listening on :${port}`);
  });
}
