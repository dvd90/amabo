import { describe, expect, it } from 'vitest';
import {
  LOW_AMBRA_THRESHOLD,
  NIGHT_SLEEP_ENERGY,
  SIM_STEP_MINUTES,
  SIM_STEP_MS,
} from './config.js';
import { advance, decideAsleep, hourOfDay, isNight } from './advance.js';
import { condenseMote, type CreatureState } from './state.js';

/** Timestamps whose step-end lands squarely in daytime / nighttime (UTC hours). */
const DAY = 12 * 3_600_000; // hour 12
const NIGHT = 23 * 3_600_000; // hour 23

describe('time helpers (M1)', () => {
  it('hourOfDay reads the UTC hour straight from the ms epoch', () => {
    expect(hourOfDay(0)).toBe(0);
    expect(hourOfDay(DAY)).toBe(12);
    expect(hourOfDay(NIGHT)).toBe(23);
  });

  it('isNight wraps midnight (late evening through early morning)', () => {
    expect(isNight(23)).toBe(true); // first operand
    expect(isNight(3)).toBe(true); // second operand
    expect(isNight(12)).toBe(false);
  });

  it('decideAsleep covers every awake/asleep transition', () => {
    // Awake → collapses when exhausted at any hour; at night it turns in early once
    // drowsy (below NIGHT_SLEEP_ENERGY) — but a rested creature stays up.
    expect(decideAsleep(false, 80, 12)).toBe(false);
    expect(decideAsleep(false, 80, 23)).toBe(false); // rested at night: still up
    expect(decideAsleep(false, NIGHT_SLEEP_ENERGY - 5, 23)).toBe(true); // drowsy at night: turns in
    expect(decideAsleep(false, NIGHT_SLEEP_ENERGY - 5, 12)).toBe(false); // same energy at noon: up
    expect(decideAsleep(false, 10, 12)).toBe(true); // exhausted: collapses even at noon
    // Asleep → rest serves the creature, not the clock: it wakes the moment it is
    // rested, whatever the hour; otherwise it stays down. (Fixes the stuck-asleep bug:
    // "night" is UTC, so the old never-wake-at-night rule could pin a fully-rested
    // creature asleep through a user's local afternoon.)
    expect(decideAsleep(true, 95, 12)).toBe(false);
    expect(decideAsleep(true, 95, 23)).toBe(false); // fully rested wakes even at night
    expect(decideAsleep(true, 50, 12)).toBe(true);
    expect(decideAsleep(true, 50, 23)).toBe(true);
  });
});

describe('advance — frame-rate independence (M1 key invariant)', () => {
  it('200 steps in one call equals 200 single-step calls', () => {
    const s0 = condenseMote(12345, 0);
    const target = 200 * SIM_STEP_MS;

    const oneShot = advance(s0, target);

    let acc = s0;
    const events = [];
    for (let i = 1; i <= 200; i++) {
      const r = advance(acc, i * SIM_STEP_MS);
      acc = r.state;
      events.push(...r.events);
    }

    expect(acc).toEqual(oneShot.state);
    expect(events).toEqual(oneShot.events);
  });

  it('steps on absolute boundaries, leaving a sub-step remainder for next time', () => {
    const s0 = condenseMote(1, 0);
    // 2.5 sim-steps requested → only 2 whole steps applied.
    const r = advance(s0, 2 * SIM_STEP_MS + SIM_STEP_MS / 2);
    expect(r.state.ageMinutes).toBe(2 * SIM_STEP_MINUTES);
    expect(r.state.lastTickAt).toBe(2 * SIM_STEP_MS);
  });
});

describe('advance — Ambra & decay (M1)', () => {
  it('the inner light and care stats fade in the dark', () => {
    const s = condenseMote(1, DAY);
    const { state } = advance(s, DAY + 12 * SIM_STEP_MS); // ~1 hour, awake daytime

    expect(state.stats.ambra).toBeLessThan(s.stats.ambra);
    expect(state.stats.cleanliness).toBeLessThan(s.stats.cleanliness);
    expect(state.stats.affection).toBeLessThan(s.stats.affection);
    expect(state.stats.security).toBeLessThan(s.stats.security);
    expect(state.stats.energy).toBeLessThan(s.stats.energy); // spent while awake
    expect(state.asleep).toBe(false);
  });

  it('decay scales by stage: a settled Bloom weathers the dark better than a Mote', () => {
    const mote = condenseMote(1, DAY);
    const bloom: CreatureState = { ...mote, stage: 'bloom' };
    const interval = DAY + 12 * SIM_STEP_MS;

    const moteDrop = mote.stats.ambra - advance(mote, interval).state.stats.ambra;
    const bloomDrop = bloom.stats.ambra - advance(bloom, interval).state.stats.ambra;

    expect(moteDrop).toBeGreaterThan(bloomDrop);
  });

  it('low Ambra starves affection faster (the moral engine, awake)', () => {
    const base = condenseMote(1, DAY);
    const low: CreatureState = {
      ...base,
      stats: { ...base.stats, ambra: LOW_AMBRA_THRESHOLD - 5 },
    };
    const interval = DAY + 12 * SIM_STEP_MS;

    const normalDrop = base.stats.affection - advance(base, interval).state.stats.affection;
    const starvedDrop = low.stats.affection - advance(low, interval).state.stats.affection;

    expect(starvedDrop).toBeGreaterThan(normalDrop);
  });

  it('low Ambra also bites while asleep, and rest still recovers energy', () => {
    const base = condenseMote(1, NIGHT);
    const s: CreatureState = {
      ...base,
      asleep: true,
      stats: { ...base.stats, ambra: LOW_AMBRA_THRESHOLD - 5, energy: 40 },
    };
    const { state } = advance(s, NIGHT + 6 * SIM_STEP_MS); // stays night

    expect(state.asleep).toBe(true);
    expect(state.stats.affection).toBeLessThan(s.stats.affection);
    expect(state.stats.energy).toBeGreaterThan(s.stats.energy); // recovered in sleep
  });

  it('keeps every stat clamped within [0, 100] over a long neglect', () => {
    const s = condenseMote(1, 0);
    const { state } = advance(s, 100_000 * SIM_STEP_MS); // ~year in the dark
    for (const v of Object.values(state.stats)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(state.stats.ambra).toBe(0);
  });
});

describe('advance — sleep cycle (M1)', () => {
  it('an exhausted creature falls asleep, emitting a single event', () => {
    const base = condenseMote(1, DAY);
    const tired: CreatureState = { ...base, stats: { ...base.stats, energy: 10 } };
    const { state, events } = advance(tired, DAY + SIM_STEP_MS);

    expect(state.asleep).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('fellAsleep');
    expect(events[0]?.at).toBe(DAY + SIM_STEP_MS);
  });

  it('a rested creature wakes in daylight, emitting a woke event', () => {
    const base = condenseMote(1, DAY);
    const rested: CreatureState = { ...base, asleep: true, stats: { ...base.stats, energy: 95 } };
    const { state, events } = advance(rested, DAY + SIM_STEP_MS);

    expect(state.asleep).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('woke');
  });
});

describe('advance — guards (M1)', () => {
  it('a creature whose light has gone out does not tick', () => {
    const s: CreatureState = { ...condenseMote(1, 0), alive: false };
    const r = advance(s, 1000 * SIM_STEP_MS);
    expect(r.state).toBe(s);
    expect(r.events).toEqual([]);
  });

  it('does nothing when no whole sim-step has elapsed', () => {
    const s = condenseMote(1, 1000);
    expect(advance(s, 1000).events).toEqual([]);
    expect(advance(s, 1000).state).toBe(s);
    expect(advance(s, 500).state).toBe(s); // clock skew / past timestamp
  });
});
