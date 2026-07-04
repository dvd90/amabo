/**
 * index.ts — the composition root. Build dependencies from the environment (12-factor)
 * and start the server. With DATABASE_URL set we use Postgres; without it an in-memory
 * repo for a zero-setup local run. Google OAuth in prod; a fake provider when its
 * secrets are absent (local dev only). The AI narrator lands in M6.
 */

import {
  generatePersona,
  localPersona,
  makeAnthropicClient,
  makeGrokClient,
  makeOpenAiCompatClient,
  type AnthropicLike,
} from '@amabo/ai';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { stripeBilling } from './billing/stripe.js';
import { envLogger, type Logger } from './logger.js';
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

/**
 * Which LLM speaks for the creatures (multi-LLM). Priority when several keys are
 * set: NARRATOR_PROVIDER (llama|grok|anthropic) decides; otherwise the first key
 * found wins in this order — LLAMA_API_KEY (Llama 3.3 70B, the current pick),
 * XAI_API_KEY (Grok), ANTHROPIC_API_KEY (Claude). No key → the local templated
 * voice. One client serves narration AND the Symposium, and everything downstream
 * (metering, ledger, fallbacks) is provider-agnostic.
 */
type LlmChoice = { client: AnthropicLike; provider: 'llama' | 'grok' | 'anthropic' };

function buildLlmClient(): LlmChoice | null {
  const pick = process.env.NARRATOR_PROVIDER;
  const candidates: { provider: LlmChoice['provider']; make: () => AnthropicLike | null }[] = [
    {
      provider: 'llama',
      make: () => {
        const key = process.env.LLAMA_API_KEY;
        if (!key) return null;
        // Llama is open-weights: a HOST serves it. Default host is Groq (fast,
        // cheap, free tier) — point LLAMA_BASE_URL at Together/DeepInfra/Fireworks
        // etc. to switch hosts; every one speaks the same OpenAI-compatible dialect.
        // Verify current model ids at the host's docs — override via env.
        const model = process.env.LLAMA_MODEL ?? 'llama-3.3-70b-versatile';
        return makeOpenAiCompatClient({
          apiKey: key,
          baseUrl: process.env.LLAMA_BASE_URL ?? 'https://api.groq.com/openai/v1',
          peekModel: model,
          milestoneModel: process.env.LLAMA_MODEL_MILESTONE ?? model,
          // Self-healing (like the Grok preset): if the host renamed the model,
          // resolve against its live /models list — a key alone stays enough.
          peekCandidates: [/llama-3\.3-70b/i, /llama-3\.3/i, /llama.*70b/i, /llama/i],
          milestoneCandidates: [/llama-3\.3-70b/i, /llama-3\.3/i, /llama.*70b/i, /llama/i],
        });
      },
    },
    {
      provider: 'grok',
      make: () => {
        const key = process.env.XAI_API_KEY;
        if (!key) return null;
        return makeGrokClient({
          apiKey: key,
          peekModel: process.env.XAI_MODEL_PEEK ?? 'grok-4-1-fast-non-reasoning',
          milestoneModel: process.env.XAI_MODEL_MILESTONE ?? 'grok-4-1-fast-reasoning',
        });
      },
    },
    {
      provider: 'anthropic',
      make: () => {
        const key = process.env.ANTHROPIC_API_KEY;
        return key ? makeAnthropicClient(key) : null;
      },
    },
  ];
  const ordered = pick ? candidates.filter((c) => c.provider === pick) : candidates;
  for (const c of ordered) {
    const client = c.make();
    if (client) return { provider: c.provider, client };
  }
  return null;
}

function buildNarrator(
  llm: ReturnType<typeof buildLlmClient>,
  repo: Repository,
  monitor: Monitor,
  logger: Logger,
): Narrator {
  const log = logger.child('narration');
  if (!llm) {
    log.warn(
      'no LLM key set (LLAMA_API_KEY / XAI_API_KEY / ANTHROPIC_API_KEY) — using the local templated narrator',
    );
    return localNarrator;
  }
  log.info('narration provider chosen', { provider: llm.provider });
  // The soul, with a sensible bill (L3): allowance + breaker + ledger around the model.
  const free = Number(process.env.NARRATION_USER_ALLOWANCE ?? 10);
  const lantern = Number(process.env.NARRATION_LANTERN_ALLOWANCE ?? 100);
  return meteredNarrator(
    aiNarrator(llm.client, log.child('model', { provider: llm.provider })),
    localNarrator,
    {
      repo,
      clock: systemClock,
      monitor,
      provider: llm.provider,
      logger: log.child('meter'),
      // The Keeper's Lantern buys a wider voice (L5); the gate reads the tier only.
      allowanceFor: async (userId) => {
        const user = await repo.getUserById(userId);
        return user?.entitlements.tier === 'lantern' ? lantern : free;
      },
      globalCallsPerDay: Number(process.env.NARRATION_DAILY_CAP ?? 2000),
    },
  );
}

/** The Symposium voice: the same LLM client (with a local fallback), else local. */
function buildSymposiumNarrator(
  llm: ReturnType<typeof buildLlmClient>,
  logger: Logger,
): SymposiumNarrator {
  if (llm)
    return aiSymposiumNarrator(
      llm.client,
      localSymposiumNarrator,
      logger.child('narration:symposium', { provider: llm.provider }),
    );
  return localSymposiumNarrator;
}

function buildRepo(logger: Logger): Repository {
  const url = process.env.DATABASE_URL;
  if (!url) {
    logger.warn('DATABASE_URL not set — using in-memory repository (data not persisted)');
    return new InMemoryRepository();
  }
  logger.info('repository: postgres (drizzle)');
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
function buildMailer(logger: Logger): { mailer: Mailer; real: boolean } {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (key && from) {
    logger.info('magic-link email via Resend', { from });
    return { mailer: resendMailer(key, from), real: true };
  }
  logger.warn(
    'no email provider configured (set RESEND_API_KEY + MAIL_FROM) — magic-link emails will only be logged to the server console',
  );
  return { mailer: consoleMailer, real: false };
}

/** The secret that signs magic-link tokens. Stable across restarts only if AUTH_SECRET is set. */
function magicSecret(logger: Logger): string {
  const s = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (s) return s;
  logger.warn(
    'AUTH_SECRET not set — magic-link tokens use a random per-boot secret (links break on restart). Set AUTH_SECRET in production.',
  );
  return randomBytes(32).toString('hex');
}

function buildAuthProvider(logger: Logger): AuthProvider {
  const { id, secret } = googleCreds();
  if (id && secret) return new GoogleAuthProvider(id, secret);
  logger.warn(
    'Google creds not set (GOOGLE_CLIENT_ID/SECRET or GOOGLE_OAUTH_ID/SECRET) — using fake auth provider (local only)',
  );
  return new FakeAuthProvider();
}

if (process.env.NODE_ENV !== 'test') {
  const logger = envLogger();
  const boot = logger.child('boot');
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
    boot.info('Google OAuth enabled — register this EXACT redirect URI in the Google console', {
      redirectUri: cb,
    });
  }

  const { mailer, real: realMailer } = buildMailer(boot);

  const repo = buildRepo(boot);
  const llm = buildLlmClient();
  const monitor = process.env.SENTRY_DSN
    ? sentryMonitor(
        process.env.SENTRY_DSN,
        process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.AMABO_VERSION ?? 'dev',
        fetch,
        logger.child('monitor'),
      )
    : nullMonitor;
  boot.info(
    process.env.SENTRY_DSN ? 'error eyes on (Sentry)' : 'SENTRY_DSN not set — error reporting off',
  );

  // The last resort: crashes that escaped every handler still leave one clear line
  // (and one monitor event) before the process dies or the promise evaporates.
  process.on('uncaughtException', (err) => {
    logger.child('process').error('uncaught exception', { err });
    monitor.capture(err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.child('process').error('unhandled promise rejection', { err: reason });
    monitor.capture(reason);
  });

  // The till (L5): open only when all three Stripe vars are set; otherwise free.
  const billing =
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_LANTERN &&
    process.env.STRIPE_WEBHOOK_SECRET
      ? stripeBilling({
          secretKey: process.env.STRIPE_SECRET_KEY,
          priceId: process.env.STRIPE_PRICE_LANTERN,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        })
      : undefined;
  if (!billing) boot.warn('Stripe vars not set — the till is closed (free mode)');
  else boot.info('the till is open (Stripe configured)');

  // The Soulmark (STORY.md §8½): LLM-elaborated when a provider is awake (a birth is
  // a milestone), always falling back to the seeded local mark; model calls land in
  // the same cost ledger as narration.
  const soulLog = logger.child('soulmark');
  const condenseSoul = async (input: {
    id: string;
    name: string;
    seed: number;
    ownerId: string | null;
  }) => {
    if (!llm) return localPersona(input);
    const out = await generatePersona(input, llm.client);
    if (out.source === 'local') {
      // The model was asked and could not answer (error or invalid shape) — the
      // seeded mark stood in. The birth still worked; ops should still know.
      soulLog.warn('model soulmark failed — the seeded mark stands in', {
        provider: llm.provider,
        creature: input.name,
      });
    }
    if (out.source === 'model') {
      await repo.addTelemetry([
        {
          name: 'narration',
          anonId: null,
          userId: input.ownerId,
          at: systemClock(),
          props: {
            mode: 'persona',
            provider: llm.provider,
            inputTokens: out.usage?.inputTokens ?? null,
            outputTokens: out.usage?.outputTokens ?? null,
          },
        },
      ]);
    }
    return out.persona;
  };

  const app = createApp({
    repo,
    clock: systemClock,
    seed: randomSeed,
    narrator: buildNarrator(llm, repo, monitor, logger),
    condenseSoul,
    billing,
    symposiumNarrator: buildSymposiumNarrator(llm, logger),
    authProvider: buildAuthProvider(boot),
    mailer,
    magicSecret: magicSecret(boot),
    logger,
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
    boot.info('amabo api listening', {
      port,
      version: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.AMABO_VERSION ?? 'dev',
    });
  });
}
