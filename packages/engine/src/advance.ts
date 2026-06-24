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
 * Steps so far: Ambra & decay (M1), the sleep cycle (M1), illness from neglect and
 * weighted ambient event rolls (M2). Disposition drift (M3) and stage/graduation
 * (M4) slot into this same loop later. Randomness is derived per step from the
 * creature's immutable seed, so rolls stay frame-rate independent.
 */

import {
  AMABO_THRESHOLD,
  AMBIENT_EVENT_CHANCE_PER_STEP,
  DECAY_PER_MIN,
  DISPOSITION_DRIFT_PER_MIN,
  ENERGY_RECOVERY_PER_MIN,
  ILLNESS_CLEANLINESS_THRESHOLD,
  ILLNESS_DISPOSITION_DRAIN_PER_MIN,
  ILLNESS_HEALTH_DRAIN_PER_MIN,
  ILLNESS_ONSET_CHANCE_PER_STEP,
  LOW_AMBRA_AFFECTION_DRAIN_PER_MIN,
  LOW_AMBRA_THRESHOLD,
  MS_PER_HOUR,
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  RECOVERY_CHANCE_PER_STEP,
  RECOVERY_CLEANLINESS,
  SIM_STEP_MINUTES,
  SIM_STEP_MS,
  SLEEP_DECAY_MULTIPLIER,
  SLEEP_ENERGY_THRESHOLD,
  STAGE_DECAY_MULTIPLIER,
  STAT_MAX,
  STAT_MIN,
  UNCANNY_THRESHOLD,
  WAKE_ENERGY,
  WELLBEING_NEUTRAL,
} from './config.js';
import { ambientTableFor, pickWeighted } from './events.js';
import { canGraduate, careTotal, nextStageFor } from './lifecycle.js';
import { clamp, clampDisposition } from './math.js';
import { deriveSeed, mulberry32 } from './rng.js';
import { deriveUncanny, type CreatureState, type SimEvent, type Stats } from './state.js';

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
  let ill = state.ill;
  let disposition = state.disposition;
  let stage = state.stage;
  let ageMinutes = state.ageMinutes;
  let lastTickAt = state.lastTickAt;
  let died = false;
  const events: SimEvent[] = [];
  const stageMult = STAGE_DECAY_MULTIPLIER[state.stage];

  for (let i = 0; i < steps; i++) {
    const stepEndTs = lastTickAt + SIM_STEP_MS;
    const hour = hourOfDay(stepEndTs);

    // A fresh generator per step, seeded from (creature seed, absolute step index),
    // keeps rolls identical no matter how the catch-up is chunked (frame-rate safe).
    const stepRng = mulberry32(deriveSeed(state.seed, Math.floor(stepEndTs / SIM_STEP_MS)));

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

    // Illness from neglect: low cleanliness risks it; restored cleanliness mends it.
    if (ill) {
      if (stats.cleanliness >= RECOVERY_CLEANLINESS && stepRng() < RECOVERY_CHANCE_PER_STEP) {
        ill = false;
        events.push({
          at: stepEndTs,
          kind: 'recovered',
          statDeltas: {},
          dispositionDelta: 0,
          salience: 3,
        });
      }
    } else if (
      stats.cleanliness < ILLNESS_CLEANLINESS_THRESHOLD &&
      stepRng() < ILLNESS_ONSET_CHANCE_PER_STEP
    ) {
      ill = true;
      events.push({
        at: stepEndTs,
        kind: 'fellIll',
        statDeltas: {},
        dispositionDelta: 0,
        salience: 3,
      });
    }
    if (ill) {
      stats.health = clamp(
        stats.health - ILLNESS_HEALTH_DRAIN_PER_MIN * restMult * stageMult * SIM_STEP_MINUTES,
        STAT_MIN,
        STAT_MAX,
      );
    }

    // Mortality (classic only): extreme sustained neglect (health gone) puts the
    // light out — it returns to Ambra (STORY.md §4). Soft creatures never die.
    if (state.mortality === 'classic' && stats.health <= STAT_MIN) {
      events.push({
        at: stepEndTs,
        kind: 'lightWentOut',
        statDeltas: {},
        dispositionDelta: 0,
        salience: 5,
      });
      died = true;
      break;
    }

    // Disposition drift (the moral engine, STORY.md §4): love that landed pulls
    // toward radiant Amabo, neglect sours toward Yim, illness drags down a little.
    const wellbeing = (stats.ambra + stats.affection + stats.security) / 3;
    let dispDrift =
      ((wellbeing - WELLBEING_NEUTRAL) / WELLBEING_NEUTRAL) *
      DISPOSITION_DRIFT_PER_MIN *
      SIM_STEP_MINUTES;
    if (ill) dispDrift -= ILLNESS_DISPOSITION_DRAIN_PER_MIN * SIM_STEP_MINUTES;
    disposition = clampDisposition(disposition + dispDrift);

    // Ambient flavor: a small, narratable moment — the table leans by disposition
    // (warm finds for an Amabo, stopped clocks for a Yim).
    if (stepRng() < AMBIENT_EVENT_CHANCE_PER_STEP) {
      const table = ambientTableFor(disposition, UNCANNY_THRESHOLD, AMABO_THRESHOLD);
      const a = pickWeighted(table, stepRng());
      events.push({
        at: stepEndTs,
        kind: 'ambient',
        tag: a.tag,
        statDeltas: {},
        dispositionDelta: 0,
        salience: a.salience,
      });
    }

    ageMinutes += SIM_STEP_MINUTES;
    lastTickAt = stepEndTs;

    // Stage check (the ladder of love): climb when age AND care allow it.
    const climbTo = nextStageFor(stage, ageMinutes, careTotal(state));
    if (climbTo) {
      stage = climbTo;
      events.push({
        at: stepEndTs,
        kind: 'evolved',
        statDeltas: {},
        dispositionDelta: 0,
        salience: 4,
        tag: climbTo,
      });
    }

    // Graduation check: a high-Amabo Bloom too bright for the glass. We emit the
    // milestone once and stop — the API then calls engine.graduate (ARCHITECTURE §8).
    if (canGraduate({ ...state, stage, disposition, ageMinutes, stats })) {
      events.push({
        at: stepEndTs,
        kind: 'graduation',
        statDeltas: {},
        dispositionDelta: 0,
        salience: 5,
      });
      break;
    }
  }

  const next: CreatureState = {
    ...state,
    stats,
    asleep,
    ill,
    disposition,
    stage,
    ageMinutes,
    lastTickAt,
    alive: state.alive && !died,
    uncanny: deriveUncanny(disposition),
  };
  return { state: next, events };
}
