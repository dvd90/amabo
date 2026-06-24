/**
 * config.ts — every tunable lives here (CLAUDE.md / ARCHITECTURE.md §11). No magic
 * numbers inline anywhere in the engine; a designer tunes the whole simulation from
 * this one file. Lore terms (ambra, disposition, stages) are spelled per STORY.md.
 */

import type { Stage } from '@amabo/shared';

/** Time. The tick runs in fixed sim-steps so behaviour is frame-rate independent. */
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const SIM_STEP_MINUTES = 5;
export const SIM_STEP_MS = SIM_STEP_MINUTES * MS_PER_MINUTE;

/** All stats live in [0, 100]. */
export const STAT_MIN = 0;
export const STAT_MAX = 100;

/**
 * Decay per minute while awake, in the dark (advancing = time passing unobserved).
 * Ambra leads: the inner love-light fades fastest when no Light is shining in.
 * `health` holds steady here — it only moves through illness (M2) and care.
 */
export const DECAY_PER_MIN = {
  ambra: 0.05,
  energy: 0.06,
  cleanliness: 0.04,
  health: 0,
  affection: 0.02,
  security: 0.02,
} as const;

/** While asleep most decay slows (rest is gentle); energy instead recovers. */
export const SLEEP_DECAY_MULTIPLIER = 0.4;
export const ENERGY_RECOVERY_PER_MIN = 0.15;

/**
 * Decay scales by stage: a fresh Mote is fragile, a settled Bloom is hardy
 * (becoming Real makes it more itself, less at the mercy of the dark — STORY.md §5).
 */
export const STAGE_DECAY_MULTIPLIER: Record<Stage, number> = {
  mote: 1.2,
  spark: 1.1,
  velveteen: 1.0,
  bloom: 0.9,
};

/** Sleep cycle: the creature rests at night (UTC hour) or when exhausted. */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
export const SLEEP_ENERGY_THRESHOLD = 15;
export const WAKE_ENERGY = 90;

/**
 * Derived effect: when the inner Ambra runs low, love itself starts to starve —
 * affection drains faster. The first hint of the moral engine (full drift is M3).
 */
export const LOW_AMBRA_THRESHOLD = 25;
export const LOW_AMBRA_AFFECTION_DRAIN_PER_MIN = 0.03;

/** Below this disposition the creature presents as a Yim (uncanny). STORY.md §4. */
export const UNCANNY_THRESHOLD = -30;

/**
 * Interactions (ARCHITECTURE.md §4.3). Care raises stats; OVER-care is punished like
 * neglect — feeding a full creature is `refused` and costs affection — which is what
 * makes disposition branch instead of climbing forever.
 */
export const FULL_AMBRA = 90; // feeding at/above this is refused
export const REFUSED_AFFECTION_PENALTY = 4;
export const PLAY_ENERGY_FLOOR = 20; // too tired to play below this

export const INTERACTION_EFFECTS = {
  feed: { ambra: 18, energy: 4, affection: 2 },
  clean: { cleanliness: 60, affection: 1 },
  play: { energy: -12, affection: 6, ambra: 3, security: 2 },
  comfort: { security: 10, affection: 5, ambra: 2 },
} as const;

/**
 * Illness from neglect (ARCHITECTURE.md §4.2 step 3). Low cleanliness risks illness;
 * illness drains health; restored cleanliness lets the creature recover.
 */
export const ILLNESS_CLEANLINESS_THRESHOLD = 30;
export const ILLNESS_ONSET_CHANCE_PER_STEP = 0.05;
export const ILLNESS_HEALTH_DRAIN_PER_MIN = 0.08;
export const RECOVERY_CLEANLINESS = 60; // clean enough to mend
export const RECOVERY_CHANCE_PER_STEP = 0.08;

/**
 * Ambient event rolls (ARCHITECTURE.md §4.2 step 5). Each step has a small chance of
 * a flavor moment. The Amabo- and Yim-leaning tables are split by disposition in M3;
 * M2 ships the neutral table and the weighted-roll machinery.
 */
export const AMBIENT_EVENT_CHANCE_PER_STEP = 0.06;
