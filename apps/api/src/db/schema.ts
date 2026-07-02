/**
 * db/schema.ts — Postgres tables via Drizzle (ARCHITECTURE.md §6). Stats live as one
 * JSONB column (always read/written together). `owner_id` is added in M5.5 (auth);
 * the column is here from the start, nullable for the single-user v1, so owner-scoping
 * drops in without a migration of meaning.
 */

import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CareTotals, SimEvent, Stats } from '@amabo/engine';

export const creatures = pgTable(
  'creatures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id'), // nullable until M5.5
    name: text('name').notNull(),
    seed: doublePrecision('seed').notNull(),
    stage: text('stage').notNull(),
    disposition: doublePrecision('disposition').notNull(),
    ageMinutes: doublePrecision('age_minutes').notNull(),
    stats: jsonb('stats').$type<Stats>().notNull(),
    asleep: boolean('asleep').notNull(),
    ill: boolean('ill').notNull(),
    uncanny: boolean('uncanny').notNull(),
    alive: boolean('alive').notNull(),
    mortality: text('mortality').notNull(),
    traits: jsonb('traits').$type<Record<string, number>>().notNull(),
    careHistory: jsonb('care_history').$type<CareTotals>().notNull(),
    lastTickAt: doublePrecision('last_tick_at').notNull(),
    graduatedAt: doublePrecision('graduated_at'),
    // Laid to rest after its ending ceremony (STORY.md §7 "Endings leave the shelf"):
    // an ascended or faded creature the Light has said goodbye to. Off the active
    // roster; a graduated one lives on as its star. Only ended lights can be archived.
    archivedAt: doublePrecision('archived_at'),
    // When the Light last explicitly looked in (peek). Distinct from lastTickAt, which
    // any background catch-up advances — this only moves on a real visit (M-B).
    lastSeenAt: doublePrecision('last_seen_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('creatures_owner_idx').on(t.ownerId)],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatureId: uuid('creature_id')
      .notNull()
      .references(() => creatures.id, { onDelete: 'cascade' }),
    at: doublePrecision('at').notNull(),
    kind: text('kind').notNull(),
    source: text('source').notNull().default('sim'), // 'sim' | 'ai' | 'user'
    statDeltas: jsonb('stat_deltas').$type<Partial<Stats>>().notNull(),
    dispositionDelta: doublePrecision('disposition_delta').notNull(),
    salience: doublePrecision('salience').notNull(),
    tag: text('tag'),
    text: text('text'),
  },
  (t) => [index('events_creature_idx').on(t.creatureId, t.at)],
);

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id, { onDelete: 'cascade' }),
  at: doublePrecision('at').notNull(),
  salience: doublePrecision('salience').notNull(),
  text: text('text').notNull(),
});

export const stars = pgTable('stars', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatureId: uuid('creature_id').notNull(),
  ownerId: uuid('owner_id'),
  name: text('name').notNull(),
  bornAt: doublePrecision('born_at').notNull(),
  graduatedAt: doublePrecision('graduated_at').notNull(),
  finalTraits: jsonb('final_traits').$type<Record<string, number>>().notNull(),
  constellationPos: jsonb('constellation_pos').$type<{ x: number; y: number }>().notNull(),
});

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatureId: uuid('creature_id')
    .notNull()
    .references(() => creatures.id, { onDelete: 'cascade' }),
  at: doublePrecision('at').notNull(),
  action: text('action').notNull(),
});

// ── M5.5: accounts & auth (ARCHITECTURE.md §14) ─────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    // The FIRST sign-in method, kept for display/back-compat. The authoritative,
    // possibly-multiple set of sign-in methods lives in `auth_identities` below — that's
    // what login actually resolves against, so a Light who signs in with Google and later
    // with a magic link to the SAME email lands in this one account, not a duplicate.
    oauthProvider: text('oauth_provider').notNull(),
    oauthSubject: text('oauth_subject').notNull(),
    ageBand: text('age_band'), // captured for the child-safety + optional-crypto gates
    // Appearance prefs (theme, pixel/smooth art) — account-level, follows the Light to
    // any device. Validated at the API boundary by `@amabo/shared`'s UserPreferences.
    preferences: jsonb('preferences'),
    // The till (L5): what this Light is entitled to, and the Stripe customer behind it.
    entitlements: jsonb('entitlements'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('users_oauth_idx').on(t.oauthProvider, t.oauthSubject)],
);

// Webhook idempotency (L5): every Stripe event id lands exactly once, replay-safe.
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  at: doublePrecision('at').notNull(),
});

// Every sign-in method linked to an account — one row per (provider, subject), many rows
// can point at the same userId. This is what makes account merging by verified email work:
// upsertUser links a new identity to an EXISTING user instead of creating a second account.
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('auth_identities_provider_subject_idx').on(t.provider, t.subject),
    index('auth_identities_user_idx').on(t.userId),
  ],
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // opaque random token (the cookie value)
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  csrfToken: text('csrf_token').notNull(),
  expiresAt: doublePrecision('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── M9.5: sharing & resonance (ARCHITECTURE.md §14) ─────────────────────────────
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatureId: uuid('creature_id')
      .notNull()
      .references(() => creatures.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id'),
    kind: text('kind').notNull(), // 'visit' | 'meet' | 'postcard' | 'gather'
    token: text('token').notNull().unique(),
    expiresAt: doublePrecision('expires_at').notNull(),
    revokedAt: doublePrecision('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('share_links_token_idx').on(t.token)],
);

export const rehomes = pgTable('rehomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatureId: uuid('creature_id').notNull(),
  fromUserId: uuid('from_user_id').notNull(),
  toUserId: uuid('to_user_id').notNull(),
  status: text('status').notNull(), // 'pending' | 'completed' | 'cancelled'
  fromConfirmedAt: doublePrecision('from_confirmed_at'),
  toConfirmedAt: doublePrecision('to_confirmed_at'),
  at: doublePrecision('at').notNull(),
});

// ── M-C: web-push notification subscriptions ────────────────────────────────────
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    lastNotifiedAt: doublePrecision('last_notified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('push_user_idx').on(t.userId)],
);

export const blocks = pgTable('blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  blockedUserId: uuid('blocked_user_id').notNull(),
  at: doublePrecision('at').notNull(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull(),
  subject: text('subject').notNull(),
  reason: text('reason'),
  at: doublePrecision('at').notNull(),
});

// ── M-S: the Symposium (STORY.md §6½) ───────────────────────────────────────────
// A held gathering of an owner's creatures: the engine outline + the narrated transcript.
export const gatherings = pgTable(
  'gatherings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id'),
    at: doublePrecision('at').notNull(),
    participantIds: jsonb('participant_ids').$type<string[]>().notNull(),
    outline: jsonb('outline').$type<unknown>().notNull(),
    transcript: jsonb('transcript').$type<unknown>(), // null until narrated
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('gatherings_owner_idx').on(t.ownerId, t.at)],
);

// A short note one creature leaves a friend it bonded with — the pen-pal thread, so a
// friendship goes on between gatherings (STORY.md §6½).
export const letters = pgTable(
  'letters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id'),
    fromCreature: uuid('from_creature').notNull(),
    toCreature: uuid('to_creature').notNull(),
    at: doublePrecision('at').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('letters_owner_idx').on(t.ownerId, t.at)],
);

// A friendship two creatures formed by harmonising. Stored once per unordered pair
// (a < b) per owner; strengthens and counts up each time they meet again.
export const bonds = pgTable(
  'bonds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id'),
    creatureA: uuid('creature_a').notNull(),
    creatureB: uuid('creature_b').notNull(),
    strength: doublePrecision('strength').notNull(),
    metCount: doublePrecision('met_count').notNull(),
    lastMetAt: doublePrecision('last_met_at').notNull(),
  },
  (t) => [index('bonds_pair_idx').on(t.ownerId, t.creatureA, t.creatureB)],
);

// The funnel (LAUNCH_PLAN.md L1): named product beats in our own Postgres — no third
// party. Doubles as the narration cost ledger in L3 (name = 'narration', props = usage).
export const telemetry = pgTable(
  'telemetry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    anonId: text('anon_id'),
    userId: uuid('user_id'),
    at: doublePrecision('at').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>(),
  },
  (t) => [index('telemetry_name_at_idx').on(t.name, t.at)],
);

export type EventRow = typeof events.$inferSelect;
export type SimEventForDb = SimEvent;
