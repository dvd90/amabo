/**
 * chronicle.ts — the Chronicle (STORY.md §8⅞). While a company of one Light's
 * creatures sits long in the dark, the glass may bring pairs together. This module
 * decides WHO met and HOW it went — warm or strained — from tempers, hearts'
 * distance, and injected chance. The chronicler (the AI layer) only writes it up.
 *
 * Small frictions, never harm, by construction: an encounter carries NO stat or
 * disposition deltas at all. It moves bonds (even a strain leaves a thread) and
 * story (the standing line), nothing else.
 *
 * Pure: time and randomness are injected; nothing here reads a clock or Math.random.
 */

import { CHRONICLE, type TemperKey } from './config.js';
import type { Rng } from './rng.js';
import type { CreatureState } from './state.js';

export interface ChronicleMember {
  id: string;
  state: CreatureState;
}

export interface EncounterOutline {
  aId: string;
  bId: string;
  valence: 'warm' | 'strained';
  /** The motif handed to the chronicler (like an ambient tag). */
  tag: string;
}

/** Warm motifs — shared warmth, small gifts, old stories (STORY.md §8⅞). */
export const ENCOUNTER_TAGS_WARM = [
  'sharedWarmth',
  'smallGift',
  'oldStoryRetold',
  'parallelPlay',
  'huddledAtDusk',
] as const;

/** Strained motifs — small frictions, never harm: envy that is really longing. */
export const ENCOUNTER_TAGS_STRAINED = [
  'sameWarmCorner',
  'borrowedLight',
  'countingGlances',
  'quietEnvy',
  'talkedPastEachOther',
] as const;

/** A temper leaning, defaulting to even-keeled (50) for lights condensed before §8⅞. */
export function temperOf(state: CreatureState, key: TemperKey): number {
  const v = state.traits[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 50;
}

/** The bond thread an encounter hangs — even a strain leaves a smaller one. */
export function bondDeltaFor(valence: 'warm' | 'strained'): number {
  return valence === 'warm' ? CHRONICLE.bondWarm : CHRONICLE.bondStrained;
}

/**
 * Roll the gap's encounters for a company. Empty when the gap was short, the
 * company is fewer than two living lights, or chance simply kept them apart.
 */
export function rollEncounters(
  members: ChronicleMember[],
  elapsedMs: number,
  rng: Rng,
): EncounterOutline[] {
  if (elapsedMs < CHRONICLE.minGapMs) return [];
  const living = members.filter((m) => m.state.alive);
  if (living.length < 2) return [];

  const chunks = Math.floor(elapsedMs / CHRONICLE.minGapMs);
  const out: EncounterOutline[] = [];

  for (let c = 0; c < chunks && out.length < CHRONICLE.maxPerGap; c++) {
    // Two distinct lights, drawn with a lean toward the sociable.
    const a = pickWeighted(living, rng, (m) => 1 + temperOf(m.state, 'sociability') / 100);
    const rest = living.filter((m) => m.id !== a.id);
    const b = pickWeighted(rest, rng, (m) => 1 + temperOf(m.state, 'sociability') / 100);

    // Did they actually meet this chunk? Sociable company drifts together more.
    const meetChance =
      CHRONICLE.encounterChancePerChunk *
      ((temperOf(a.state, 'sociability') + temperOf(b.state, 'sociability')) / 100);
    if (rng() >= meetChance) continue;

    // How it went: hearts' distance strains; jealousy tilts; warmth soothes.
    const gap = Math.abs(a.state.disposition - b.state.disposition);
    const jealousy = (temperOf(a.state, 'jealousy') + temperOf(b.state, 'jealousy')) / 2;
    const warmth = (temperOf(a.state, 'warmth') + temperOf(b.state, 'warmth')) / 2;
    const strain =
      Math.min(1, gap / (CHRONICLE.warmGap * 2)) * 0.6 +
      (jealousy / 100) * 0.3 -
      (warmth / 100) * 0.2;
    const valence: EncounterOutline['valence'] =
      rng() < Math.max(0.05, strain) ? 'strained' : 'warm';

    const pool = valence === 'warm' ? ENCOUNTER_TAGS_WARM : ENCOUNTER_TAGS_STRAINED;
    out.push({ aId: a.id, bId: b.id, valence, tag: pool[Math.floor(rng() * pool.length)]! });
  }
  return out;
}

/** Roulette pick by weight. The last item takes whatever the roll leaves (float-safe). */
function pickWeighted<T>(items: T[], rng: Rng, weightOf: (item: T) => number): T {
  const total = items.reduce((sum, it) => sum + weightOf(it), 0);
  let x = rng() * total;
  for (let i = 0; i < items.length - 1; i++) {
    x -= weightOf(items[i]!);
    if (x < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
