/**
 * daypath.ts — the Little World (STORY.md §8¾). After a long absence the glass deals
 * the creature a few EQUAL ways it might have spent the stretch; something else (the
 * AI layer, in character) picks one; the engine records the pick as a pure flavor
 * event. The dealer's law is enforced here by construction:
 *
 *  - every dealt option is legal and register-appropriate (Amabo/neutral/Yim);
 *  - all options are mechanically IDENTICAL — zero stat deltas, zero disposition;
 *  - an invalid pick collapses to the first-dealt option, so an untrusted chooser
 *    can never deal itself a better hand or stall the world.
 *
 * Pure: time and randomness are injected; nothing here reads a clock or Math.random.
 */

import { AMABO_THRESHOLD, DAYPATH, UNCANNY_THRESHOLD } from './config.js';
import type { Rng } from './rng.js';
import type { CreatureState, SimEvent } from './state.js';

export interface DaypathOption {
  /** Stable id the chooser answers with. */
  id: string;
  /** The motif handed to narration (like an ambient tag). */
  tag: string;
  /** A short, plain hint of what the day was — data for the chooser, never orders. */
  hint: string;
}

/** Quiet, ordinary days — the in-between register. */
export const DAYPATHS_NEUTRAL: readonly DaypathOption[] = [
  { id: 'kept-the-warm-corner', tag: 'keptWarmCorner', hint: 'kept to the warm corner and dozed' },
  { id: 'watched-the-glass', tag: 'watchedGlass', hint: 'watched the light move across the glass' },
  { id: 'practised-a-shape', tag: 'triedAShape', hint: 'practised being a different shape' },
  { id: 'sorted-small-things', tag: 'sortedSmallThings', hint: 'arranged its few small things' },
  { id: 'hummed-to-itself', tag: 'hummedToItself', hint: 'hummed a tune of its own invention' },
];

/** Amabo-leaning — warm, makerly hours (STORY.md §4, §9). */
export const DAYPATHS_AMABO: readonly DaypathOption[] = [
  { id: 'built-a-small-thing', tag: 'builtSmallThing', hint: 'built a small thing to show you' },
  { id: 'tended-the-moss', tag: 'tendedMoss', hint: 'tended the moss until it stood up' },
  { id: 'kept-a-welcome-ready', tag: 'keptWelcome', hint: 'kept a welcome ready by the door' },
  { id: 'made-the-light-rounder', tag: 'rounderShape', hint: 'practised being rounder, kinder' },
  { id: 'sang-to-the-glass', tag: 'sangToGlass', hint: 'sang quietly to the glass' },
];

/** Yim-leaning — stopped clocks and kept vigils (STORY.md §4, §11). */
export const DAYPATHS_YIM: readonly DaypathOption[] = [
  { id: 'counted-the-hours', tag: 'countedHours', hint: 'counted the hours, twice' },
  { id: 'kept-the-stopped-clock', tag: 'stoppedClock', hint: 'kept the stopped clock company' },
  { id: 'waited-by-the-door', tag: 'waitedByDoor', hint: 'waited where the light comes in' },
  { id: 'listened-for-the-latch', tag: 'listenedLatch', hint: 'listened for the latch' },
  { id: 'tidied-the-dark', tag: 'tidiedDark', hint: 'tidied a corner of the dark' },
];

/** Chosen days that MAKE something — a keepsake stays on the shelf (STORY.md §8¾). */
export const DAYPATH_MAKERS = [
  'builtSmallThing',
  'tendedMoss',
  'sangToGlass',
  'sortedSmallThings',
] as const;

function tableFor(disposition: number): readonly DaypathOption[] {
  if (disposition < UNCANNY_THRESHOLD) return DAYPATHS_YIM;
  if (disposition >= AMABO_THRESHOLD) return DAYPATHS_AMABO;
  return DAYPATHS_NEUTRAL;
}

/**
 * Deal the equal hand for a finished absence. Empty when the absence was too short
 * or the light has ended — the world simply doesn't ask.
 */
export function dealDaypaths(state: CreatureState, elapsedMs: number, rng: Rng): DaypathOption[] {
  if (!state.alive || elapsedMs < DAYPATH.minAbsenceMs) return [];
  const pool = [...tableFor(state.disposition)];
  const dealt: DaypathOption[] = [];
  for (let i = 0; i < DAYPATH.options && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    dealt.push(pool.splice(idx, 1)[0]!);
  }
  return dealt;
}

/**
 * Record the soul's pick as a pure flavor event. An id not in the dealt hand (an
 * untrusted chooser talking nonsense) collapses to the first-dealt option.
 */
export function applyDaypath(dealt: DaypathOption[], choiceId: string, now: number): SimEvent {
  const chosen = dealt.find((o) => o.id === choiceId) ?? dealt[0]!;
  return {
    at: now,
    kind: 'daypath',
    statDeltas: {},
    dispositionDelta: 0,
    salience: DAYPATH.salience,
    tag: chosen.tag,
  };
}
