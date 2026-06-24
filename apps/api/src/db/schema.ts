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

export type EventRow = typeof events.$inferSelect;
export type SimEventForDb = SimEvent;
