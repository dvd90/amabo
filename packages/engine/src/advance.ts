/**
 * advance.ts — the tick (ARCHITECTURE.md §4.2). PURE: time is the injected `toTs`,
 * never the wall clock. The Amarium advances only when observed (the lazy model,
 * §3): on a read we replay the gap in fixed sim-steps and return the new state plus
 * the events that happened in the dark.
 *
 * KEY INVARIANT — frame-rate independence: the result depends only on the absolute
 * step boundaries, never on how the catch-up is chunked. Advancing 200 steps in one
 * call equals 200 single-step calls (§4.5). We achieve this by stepping on absolute
 * multiples of SIM_STEP_MS and leaving any sub-step remainder for next time.
 *
 * M1 covers Ambra & decay (step 1) and the sleep cycle (step 2), plus the first
 * derived effect (low Ambra starves affection). Disposition drift (M3), event rolls
 * & illness (M2), stage/graduation (M4) slot into this same loop later.
 */

import {
  DECAY_PER_MIN,
  ENERGY_RECOVERY_PER_MIN,
  LOW_AMBRA_AFFECTION_DRAIN_PER_MIN,
  LOW_AMBRA_THRESHOLD,
  MS_PER_HOUR,
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  SIM_STEP_MINUTES,
  SIM_STEP_MS,
  SLEEP_DECAY_MULTIPLIER,
  SLEEP_ENERGY_THRESHOLD,
  STAGE_DECAY_MULTIPLIER,
  STAT_MAX,
  STAT_MIN,
  UNCANNY_THRESHOLD,
  WAKE_ENERGY,
} from './config.js';
import { clamp } from './math.js';
import type { CreatureState, SimEvent, Stats } from './state.js';

/** UTC hour-of-day for an instant. Pure (no Date): derived straight from the ms epoch. */
export function hourOfDay(ts: number): number {
  return Math.floor(ts / MS_PER_HOUR) % 24;
}

/** Night wraps midnight: late evening through early morning. */
export function isNight(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/** Decide the sleep state for a step from the current energy and the hour. */
export function decideAsleep(asleep: boolean, energy: number, hour: number): boolean {
  if (asleep) {
    // Stay resting until rested, and never wake back into the night.
    return energy < WAKE_ENERGY || isNight(hour);
  }
  // Awake: drift off at night, or collapse when exhausted.
  return isNight(hour) || energy <= SLEEP_ENERGY_THRESHOLD;
}

export function advance(
  state: CreatureState,
  toTs: number,
): { state: CreatureState; events: SimEvent[] } {
  // A light that has gone out does not tick (mortality is M4; this is the guard).
  if (!state.alive) {
    return { state, events: [] };
  }

  const steps = Math.floor((toTs - state.lastTickAt) / SIM_STEP_MS);
  if (steps <= 0) {
    return { state, events: [] };
  }

  const stats: Stats = { ...state.stats };
  let asleep = state.asleep;
  let ageMinutes = state.ageMinutes;
  let lastTickAt = state.lastTickAt;
  const events: SimEvent[] = [];
  const stageMult = STAGE_DECAY_MULTIPLIER[state.stage];

  for (let i = 0; i < steps; i++) {
    const stepEndTs = lastTickAt + SIM_STEP_MS;
    const hour = hourOfDay(stepEndTs);

    const nextAsleep = decideAsleep(asleep, stats.energy, hour);
    if (nextAsleep !== asleep) {
      events.push({
        at: stepEndTs,
        kind: nextAsleep ? 'fellAsleep' : 'woke',
        statDeltas: {},
        dispositionDelta: 0,
        salience: 1,
      });
    }
    asleep = nextAsleep;

    // Rest is gentle: most decay slows while asleep. Stage and step length fold in.
    const restMult = asleep ? SLEEP_DECAY_MULTIPLIER : 1;
    const decayMult = restMult * stageMult * SIM_STEP_MINUTES;

    stats.ambra = clamp(stats.ambra - DECAY_PER_MIN.ambra * decayMult, STAT_MIN, STAT_MAX);
    stats.cleanliness = clamp(
      stats.cleanliness - DECAY_PER_MIN.cleanliness * decayMult,
      STAT_MIN,
      STAT_MAX,
    );
    stats.health = clamp(stats.health - DECAY_PER_MIN.health * decayMult, STAT_MIN, STAT_MAX);
    stats.security = clamp(stats.security - DECAY_PER_MIN.security * decayMult, STAT_MIN, STAT_MAX);

    // Affection drains gently — faster when the inner Ambra has run low.
    let affectionDrain = DECAY_PER_MIN.affection * decayMult;
    if (stats.ambra < LOW_AMBRA_THRESHOLD) {
      affectionDrain += LOW_AMBRA_AFFECTION_DRAIN_PER_MIN * decayMult;
    }
    stats.affection = clamp(stats.affection - affectionDrain, STAT_MIN, STAT_MAX);

    // Energy recovers in sleep, spends while awake.
    if (asleep) {
      stats.energy = clamp(
        stats.energy + ENERGY_RECOVERY_PER_MIN * SIM_STEP_MINUTES,
        STAT_MIN,
        STAT_MAX,
      );
    } else {
      stats.energy = clamp(
        stats.energy - DECAY_PER_MIN.energy * stageMult * SIM_STEP_MINUTES,
        STAT_MIN,
        STAT_MAX,
      );
    }

    ageMinutes += SIM_STEP_MINUTES;
    lastTickAt = stepEndTs;
  }

  const next: CreatureState = {
    ...state,
    stats,
    asleep,
    ageMinutes,
    lastTickAt,
    uncanny: state.disposition < UNCANNY_THRESHOLD,
  };
  return { state: next, events };
}
