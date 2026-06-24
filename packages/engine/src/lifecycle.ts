/**
 * lifecycle.ts — the climb and the close (ARCHITECTURE.md §4.4, §8; STORY.md §5–7).
 * PURE. Stage gates (Mote→Bloom), the Symposium split (`multiply`), and graduation
 * into Elysium (`graduate` → a named `Star`). The stage check and graduation
 * *detection* run inside `advance`; `multiply`/`graduate` are called by the API when
 * the engine says they're allowed.
 */

import { STAGES, type Stage } from '@amabo/shared';
import { GRADUATION, MULTIPLY, STAGE_GATES } from './config.js';
import { mulberry32 } from './rng.js';
import type { CreatureState } from './state.js';

/** A graduated soul, kept against forgetting as a named star (STORY.md §7, Mnemosyne). */
export interface Star {
  name: string;
  bornAt: number;
  graduatedAt: number;
  finalTraits: Record<string, number>;
  /** Deterministic spot in the glass sky, derived from the creature's seed. */
  constellationPos: { x: number; y: number };
}

/** Total acts of care — the love that makes a creature Real (STORY.md §5). */
export function careTotal(state: CreatureState): number {
  const { fed, cleaned, played, comforted } = state.careHistory;
  return fed + cleaned + played + comforted;
}

/**
 * The next stage a creature is ready for, or null if it cannot climb yet (or is
 * already a Bloom). A stage opens only when both age AND care meet its gate.
 */
export function nextStageFor(stage: Stage, ageMinutes: number, care: number): Stage | null {
  const idx = STAGES.indexOf(stage);
  const next = STAGES[idx + 1];
  if (!next) return null; // already at Bloom
  const gate = STAGE_GATES[next as 'spark' | 'velveteen' | 'bloom'];
  if (ageMinutes >= gate.ageMinutes && care >= gate.care) return next;
  return null;
}

/** Only a high-Amabo Bloom — radiant, secure, old enough — may graduate (STORY.md §7). */
export function canGraduate(state: CreatureState): boolean {
  return (
    state.alive &&
    state.stage === 'bloom' &&
    state.disposition >= GRADUATION.disposition &&
    state.ageMinutes >= GRADUATION.ageMinutes &&
    state.stats.ambra >= GRADUATION.ambra &&
    state.stats.security >= GRADUATION.security
  );
}

/**
 * Dissolve a fully-loved Bloom into a Star (the into-the-West goodbye). The API
 * supplies the kept `name` and the `graduatedAt` instant; everything else is derived
 * deterministically from the creature so the same soul always lands in the same spot.
 */
export function graduate(state: CreatureState, name: string, graduatedAt: number): { star: Star } {
  if (!canGraduate(state)) {
    throw new Error('only a high-Amabo Bloom may graduate');
  }
  const r = mulberry32(state.seed);
  return {
    star: {
      name,
      bornAt: graduatedAt - state.ageMinutes * 60_000,
      graduatedAt,
      finalTraits: { ...state.traits, disposition: state.disposition, ambra: state.stats.ambra },
      constellationPos: { x: r(), y: r() },
    },
  };
}

/** A settled creature overflowing with Ambra is ready to split (STORY.md §6). */
export function canMultiply(state: CreatureState): boolean {
  return (
    state.alive &&
    STAGES.indexOf(state.stage) >= MULTIPLY.minStageIndex &&
    state.stats.ambra >= MULTIPLY.ambra
  );
}

/**
 * The Symposium split: love full enough overflows and divides, producing a second
 * creature — its other half — without either losing anything. Ambra is conserved
 * (parent + child total = the pre-split Ambra); both carry a faint pull toward each
 * other (`siblingPull`).
 */
export function multiply(state: CreatureState): { parent: CreatureState; child: CreatureState } {
  if (!canMultiply(state)) {
    throw new Error('a creature must overflow with Ambra to multiply');
  }
  const half = state.stats.ambra / 2;
  const childSeed = mulberry32(state.seed + state.ageMinutes)() * 0xffffffff;

  const parent: CreatureState = {
    ...state,
    stats: { ...state.stats, ambra: half },
    traits: { ...state.traits, siblingPull: 1 },
  };

  const child: CreatureState = {
    seed: Math.floor(childSeed),
    stage: 'mote',
    disposition: 0,
    ageMinutes: 0,
    stats: {
      ambra: half,
      energy: 80,
      cleanliness: 100,
      health: 100,
      affection: 50,
      security: 50,
    },
    asleep: false,
    ill: false,
    uncanny: false,
    alive: true,
    mortality: state.mortality,
    traits: { siblingPull: 1 },
    careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
    lastTickAt: state.lastTickAt,
  };

  return { parent, child };
}
