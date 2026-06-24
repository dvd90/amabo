/**
 * interact.ts — the care actions (ARCHITECTURE.md §4.3). PURE. The Light tends the
 * creature; the engine decides what that does. OVER-care is punished like neglect —
 * feeding a full creature is `refused` and costs affection — so that disposition
 * branches (M3) instead of climbing forever. `comfort` is the Yim-redemption lever;
 * its disposition nudge is wired in M3, here it restores security and affection.
 *
 * Events carry `at: state.lastTickAt` — the API runs `advance(now)` first, so after
 * catch-up `lastTickAt` is the current instant.
 */

import {
  FULL_AMBRA,
  INTERACTION_EFFECTS,
  PLAY_ENERGY_FLOOR,
  REFUSED_AFFECTION_PENALTY,
  STAT_MAX,
  STAT_MIN,
} from './config.js';
import { clamp } from './math.js';
import type { CreatureState, SimEvent, Stats } from './state.js';

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

function event(state: CreatureState, kind: SimEvent['kind'], statDeltas: Partial<Stats>): SimEvent {
  return { at: state.lastTickAt, kind, statDeltas, dispositionDelta: 0, salience: 2 };
}

export function interact(state: CreatureState, action: InteractAction): Result {
  if (!state.alive) {
    return { state, events: [] };
  }

  switch (action) {
    case 'feed': {
      // A full creature refuses more — over-care stings (ARCHITECTURE.md §4.3).
      if (state.stats.ambra >= FULL_AMBRA) {
        const deltas = { affection: -REFUSED_AFFECTION_PENALTY };
        return {
          state: { ...state, stats: applyDeltas(state.stats, deltas) },
          events: [event(state, 'refused', deltas)],
        };
      }
      const deltas = INTERACTION_EFFECTS.feed;
      return {
        state: {
          ...state,
          stats: applyDeltas(state.stats, deltas),
          careHistory: { ...state.careHistory, fed: state.careHistory.fed + 1 },
        },
        events: [event(state, 'fed', deltas)],
      };
    }

    case 'clean': {
      const deltas = INTERACTION_EFFECTS.clean;
      return {
        state: {
          ...state,
          stats: applyDeltas(state.stats, deltas),
          careHistory: { ...state.careHistory, cleaned: state.careHistory.cleaned + 1 },
        },
        events: [event(state, 'cleaned', deltas)],
      };
    }

    case 'play': {
      // Too tired to play — no benefit, just a small refusal.
      if (state.stats.energy < PLAY_ENERGY_FLOOR) {
        return { state, events: [event(state, 'tooTired', {})] };
      }
      const deltas = INTERACTION_EFFECTS.play;
      return {
        state: {
          ...state,
          stats: applyDeltas(state.stats, deltas),
          careHistory: { ...state.careHistory, played: state.careHistory.played + 1 },
        },
        events: [event(state, 'played', deltas)],
      };
    }

    case 'comfort': {
      const deltas = INTERACTION_EFFECTS.comfort;
      return {
        state: {
          ...state,
          stats: applyDeltas(state.stats, deltas),
          careHistory: { ...state.careHistory, comforted: state.careHistory.comforted + 1 },
        },
        events: [event(state, 'comforted', deltas)],
      };
    }

    case 'sleep': {
      if (state.asleep) return { state, events: [] };
      return { state: { ...state, asleep: true }, events: [event(state, 'fellAsleep', {})] };
    }

    case 'wake': {
      if (!state.asleep) return { state, events: [] };
      return { state: { ...state, asleep: false }, events: [event(state, 'woke', {})] };
    }
  }
}
