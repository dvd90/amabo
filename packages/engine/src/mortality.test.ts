import { describe, expect, it } from 'vitest';
import { SIM_STEP_MS } from './config.js';
import { advance } from './advance.js';
import { condenseMote, type CreatureState } from './state.js';

/** A filthy creature so illness sets in and drains health toward zero. */
const filthy = (mortality: 'soft' | 'classic'): CreatureState => {
  const base = condenseMote(7, 0);
  return { ...base, mortality, stats: { ...base.stats, cleanliness: 2 } };
};

describe('mortality (M9)', () => {
  it('classic: extreme sustained neglect puts the light out', () => {
    const { state, events } = advance(filthy('classic'), 5000 * SIM_STEP_MS);
    expect(state.alive).toBe(false);
    expect(events.some((e) => e.kind === 'lightWentOut')).toBe(true);
  });

  it('soft (default): the light never goes out, even fully neglected', () => {
    const { state, events } = advance(filthy('soft'), 5000 * SIM_STEP_MS);
    expect(state.alive).toBe(true);
    expect(state.stats.health).toBe(0); // can suffer, but does not die
    expect(events.some((e) => e.kind === 'lightWentOut')).toBe(false);
  });

  it('a creature whose light has gone out does not tick further', () => {
    const dead = advance(filthy('classic'), 5000 * SIM_STEP_MS).state;
    const again = advance(dead, dead.lastTickAt + 1000 * SIM_STEP_MS);
    expect(again.state).toBe(dead);
    expect(again.events).toEqual([]);
  });
});
