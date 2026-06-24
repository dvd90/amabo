import { describe, expect, it } from 'vitest';
import { SIM_STEP_MS } from './config.js';
import { advance } from './advance.js';
import { condenseMote, type CreatureState } from './state.js';

describe('advance — illness from neglect (M2)', () => {
  it('a creature left filthy falls ill and loses health', () => {
    const filthy: CreatureState = {
      ...condenseMote(7, 0),
      stats: { ...condenseMote(7, 0).stats, cleanliness: 5 },
    };
    const { state, events } = advance(filthy, 800 * SIM_STEP_MS);

    expect(state.ill).toBe(true);
    expect(state.stats.health).toBeLessThan(100);
    expect(events.some((e) => e.kind === 'fellIll')).toBe(true);
  });

  it('an ill creature kept clean recovers', () => {
    const sick: CreatureState = { ...condenseMote(7, 0), ill: true }; // starts clean (100)
    const { state, events } = advance(sick, 200 * SIM_STEP_MS);

    expect(state.ill).toBe(false);
    expect(events.some((e) => e.kind === 'recovered')).toBe(true);
  });
});

describe('advance — ambient flavor (M2)', () => {
  it('emits tagged ambient moments over time', () => {
    const { events } = advance(condenseMote(42, 0), 300 * SIM_STEP_MS);
    const ambient = events.filter((e) => e.kind === 'ambient');
    expect(ambient.length).toBeGreaterThan(0);
    for (const e of ambient) {
      expect(typeof e.tag).toBe('string');
      expect(e.statDeltas).toEqual({});
    }
  });
});

describe('advance — fixed seed → fixed event sequence (M2)', () => {
  it('is fully deterministic for a given seed', () => {
    const a = advance(condenseMote(2024, 0), 500 * SIM_STEP_MS);
    const b = advance(condenseMote(2024, 0), 500 * SIM_STEP_MS);
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
  });

  it('matches the recorded snapshot of event kinds', () => {
    const { events } = advance(condenseMote(2024, 0), 300 * SIM_STEP_MS);
    const sequence = events.map((e) => `${e.kind}${e.tag ? ':' + e.tag : ''}`);
    expect(sequence).toMatchSnapshot();
  });
});
