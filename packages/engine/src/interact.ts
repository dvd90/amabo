/**
 * interact.ts — the care actions (ARCHITECTURE.md §4.3). PURE. The Light tends the
 * creature; the engine decides what that does. OVER-care is punished like neglect —
 * feeding a full creature is `refused` and costs affection — so that disposition
 * branches instead of climbing forever. `comfort` is the Yim-redemption lever
 * (Beauty and the Beast): it restores security/affection AND pulls disposition back
 * toward the light (STORY.md §4).
 *
 * Events carry `at: state.lastTickAt` — the API runs `advance(now)` first, so after
 * catch-up `lastTickAt` is the current instant.
 */

import {
  CLEAN_ENOUGH,
  DISPOSITION_NUDGE,
  FULL_AMBRA,
  INTERACTION_EFFECTS,
  PLAY_ENERGY_FLOOR,
  REFUSED_AFFECTION_PENALTY,
  SECURE_ENOUGH,
  STAT_MAX,
  STAT_MIN,
} from './config.js';
import { clamp, clampDisposition } from './math.js';
import {
  deriveUncanny,
  type CareTotals,
  type CreatureState,
  type SimEvent,
  type Stats,
} from './state.js';

export type InteractAction = 'feed' | 'clean' | 'play' | 'comfort' | 'sleep' | 'wake';

type Result = { state: CreatureState; events: SimEvent[] };

/** Apply stat deltas with clamping, returning a fresh Stats object. */
function applyDeltas(stats: Stats, deltas: Partial<Stats>): Stats {
  const next: Stats = { ...stats };
  for (const key of Object.keys(deltas) as (keyof Stats)[]) {
    // key comes from the object's own keys, so the value is always present.
    next[key] = clamp(next[key] + deltas[key]!, STAT_MIN, STAT_MAX);
  }
  return next;
}

/** Build the state+event for an act of care, folding in its disposition nudge. */
function care(
  state: CreatureState,
  kind: SimEvent['kind'],
  deltas: Partial<Stats>,
  carePatch: Partial<CareTotals>,
  dispositionDelta: number,
): Result {
  const disposition = clampDisposition(state.disposition + dispositionDelta);
  return {
    state: {
      ...state,
      stats: applyDeltas(state.stats, deltas),
      careHistory: { ...state.careHistory, ...carePatch },
      disposition,
      uncanny: deriveUncanny(disposition),
    },
    events: [{ at: state.lastTickAt, kind, statDeltas: deltas, dispositionDelta, salience: 2 }],
  };
}

export function interact(state: CreatureState, action: InteractAction): Result {
  if (!state.alive) {
    return { state, events: [] };
  }

  switch (action) {
    case 'feed': {
      // A full creature refuses more — over-care stings (ARCHITECTURE.md §4.3).
      if (state.stats.ambra >= FULL_AMBRA) {
        return care(
          state,
          'refused',
          { affection: -REFUSED_AFFECTION_PENALTY },
          {},
          DISPOSITION_NUDGE.refused,
        );
      }
      return care(
        state,
        'fed',
        INTERACTION_EFFECTS.feed,
        { fed: state.careHistory.fed + 1, neglectedSteps: 0 },
        DISPOSITION_NUDGE.care,
      );
    }

    case 'clean': {
      // Already spotless — scrubbing a clean creature is over-care, and it stings.
      if (state.stats.cleanliness >= CLEAN_ENOUGH) {
        return care(
          state,
          'refused',
          { affection: -REFUSED_AFFECTION_PENALTY },
          {},
          DISPOSITION_NUDGE.refused,
        );
      }
      return care(
        state,
        'cleaned',
        INTERACTION_EFFECTS.clean,
        { cleaned: state.careHistory.cleaned + 1, neglectedSteps: 0 },
        DISPOSITION_NUDGE.care,
      );
    }

    case 'play': {
      // Too tired to play — no benefit, just a small refusal.
      if (state.stats.energy < PLAY_ENERGY_FLOOR) {
        return {
          state,
          events: [
            {
              at: state.lastTickAt,
              kind: 'tooTired',
              statDeltas: {},
              dispositionDelta: 0,
              salience: 2,
            },
          ],
        };
      }
      return care(
        state,
        'played',
        INTERACTION_EFFECTS.play,
        { played: state.careHistory.played + 1, neglectedSteps: 0 },
        DISPOSITION_NUDGE.care,
      );
    }

    case 'comfort': {
      // Comfort is for need (the redemption lever, STORY.md §4) — a creature already
      // at peace refuses it, so spamming can never pump disposition toward the light.
      if (state.stats.security >= SECURE_ENOUGH) {
        return care(
          state,
          'refused',
          { affection: -REFUSED_AFFECTION_PENALTY },
          {},
          DISPOSITION_NUDGE.refused,
        );
      }
      return care(
        state,
        'comforted',
        INTERACTION_EFFECTS.comfort,
        { comforted: state.careHistory.comforted + 1, neglectedSteps: 0 },
        DISPOSITION_NUDGE.comfort,
      );
    }

    case 'sleep': {
      if (state.asleep) return { state, events: [] };
      return {
        state: { ...state, asleep: true },
        events: [
          {
            at: state.lastTickAt,
            kind: 'fellAsleep',
            statDeltas: {},
            dispositionDelta: 0,
            salience: 2,
          },
        ],
      };
    }

    case 'wake': {
      if (!state.asleep) return { state, events: [] };
      return {
        state: { ...state, asleep: false },
        events: [
          { at: state.lastTickAt, kind: 'woke', statDeltas: {}, dispositionDelta: 0, salience: 2 },
        ],
      };
    }
  }
}
