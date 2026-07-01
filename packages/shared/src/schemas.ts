/**
 * schemas.ts — zod schemas for every boundary (CLAUDE.md: validate API in/out and AI
 * output). These mirror the engine's domain types; a conformance test in apps/api
 * asserts they stay structurally identical, so drift fails typecheck rather than
 * leaking past a boundary at runtime.
 */

import { z } from 'zod';
import { DISPOSITION_MAX, DISPOSITION_MIN, MORTALITIES, STAGES } from './consts.js';

const stat = z.number().min(0).max(100);

export const StageSchema = z.enum(STAGES);
export const MortalitySchema = z.enum(MORTALITIES);

export const StatsSchema = z.object({
  ambra: stat,
  energy: stat,
  cleanliness: stat,
  health: stat,
  affection: stat,
  security: stat,
});

export const CareTotalsSchema = z.object({
  fed: z.number().int().min(0),
  cleaned: z.number().int().min(0),
  played: z.number().int().min(0),
  comforted: z.number().int().min(0),
  neglectedSteps: z.number().int().min(0),
});

export const CreatureStateSchema = z.object({
  seed: z.number(),
  stage: StageSchema,
  disposition: z.number().min(DISPOSITION_MIN).max(DISPOSITION_MAX),
  ageMinutes: z.number().min(0),
  stats: StatsSchema,
  asleep: z.boolean(),
  ill: z.boolean(),
  uncanny: z.boolean(),
  alive: z.boolean(),
  mortality: MortalitySchema,
  traits: z.record(z.string(), z.number()),
  careHistory: CareTotalsSchema,
  lastTickAt: z.number(),
});

export const SimEventSchema = z.object({
  at: z.number(),
  kind: z.string(),
  statDeltas: z.record(z.string(), z.number()),
  dispositionDelta: z.number(),
  salience: z.number(),
  tag: z.string().optional(),
});

export const StarSchema = z.object({
  name: z.string(),
  bornAt: z.number(),
  graduatedAt: z.number(),
  finalTraits: z.record(z.string(), z.number()),
  constellationPos: z.object({ x: z.number(), y: z.number() }),
});

/** Care actions accepted by POST /creatures/:id/interact. */
export const InteractActionSchema = z.enum(['feed', 'clean', 'play', 'comfort', 'sleep', 'wake']);

// ── API request bodies ─────────────────────────────────────────────────────────
export const CreateCreatureRequest = z.object({
  name: z.string().min(1).max(64),
  /**
   * Optional seed — lets the ephemeral Mote a visitor met before signing in (the
   * pre-signup birth moment) become the very creature they keep. Omitted → server picks.
   */
  seed: z.number().int().optional(),
});
export const InteractRequest = z.object({
  action: InteractActionSchema,
});
/** Passwordless email sign-in (the launch auth path; OAuth providers layer on top). */
export const EmailLoginRequest = z.object({
  email: z.string().trim().email().max(254),
});

/**
 * A Light's appearance preferences (the colour theme + the pixel/smooth art switch),
 * saved at the account level so they follow you to any device. `theme` is kept as an
 * opaque short id (not an enum) so the web can add themes without an API release.
 */
export const UserPreferences = z.object({
  theme: z.string().min(1).max(32).optional(),
  pixelMode: z.boolean().optional(),
});
export type UserPreferencesT = z.infer<typeof UserPreferences>;

// ── API response views ─────────────────────────────────────────────────────────
export const CreatureView = z.object({
  id: z.string(),
  name: z.string(),
  state: CreatureStateSchema,
  graduatedAt: z.number().nullable(),
  /** Laid to rest after its ending ceremony (STORY.md §7); off the active roster. */
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  /** When the Light last looked in (peek); null if never. Drives "Xh ago" on the roster. */
  lastSeenAt: z.number().nullable(),
});

export type CreatureViewT = z.infer<typeof CreatureView>;
export type SimEventT = z.infer<typeof SimEventSchema>;
