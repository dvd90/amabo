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
    oauthProvider: text('oauth_provider').notNull(),
    oauthSubject: text('oauth_subject').notNull(),
    ageBand: text('age_band'), // captured for the child-safety + optional-crypto gates
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('users_oauth_idx').on(t.oauthProvider, t.oauthSubject)],
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
    kind: text('kind').notNull(), // 'visit' | 'meet' | 'postcard'
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

export type EventRow = typeof events.$inferSelect;
export type SimEventForDb = SimEvent;
