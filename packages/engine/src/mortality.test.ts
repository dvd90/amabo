import { describe, expect, it } from 'vitest';
import { LETHE_DISPOSITION, LETHE_STEPS, SIM_STEP_MS } from './config.js';
import { advance } from './advance.js';
import { interact } from './interact.js';
import { condenseMote, type CreatureState } from './state.js';

/** A filthy creature so illness sets in and drains health toward zero. */
const filthy = (mortality: 'soft' | 'classic'): CreatureState => {
  const base = condenseMote(7, 0);
  return { ...base, mortality, stats: { ...base.stats, cleanliness: 2 } };
};

/** Total abandonment: wellbeing at the floor, the heart fully soured. */
const forsaken = (): CreatureState => {
  const base = condenseMote(7, 0);
  return {
    ...base,
    disposition: LETHE_DISPOSITION - 5,
    uncanny: true,
    stats: { ...base.stats, ambra: 0, affection: 0, security: 0 },
  };
};

describe('mortality (M9 + Lethe, STORY.md §7)', () => {
  it('classic: extreme sustained neglect puts the light out', () => {
    const { state, events } = advance(filthy('classic'), 5000 * SIM_STEP_MS);
    expect(state.alive).toBe(false);
    expect(events.some((e) => e.kind === 'lightWentOut')).toBe(true);
  });

  it('soft: no sudden death — a week of illness and hunger leaves it suffering but alive', () => {
    const { state } = advance(filthy('soft'), 2000 * SIM_STEP_MS);
    expect(state.alive).toBe(true);
    expect(state.stats.health).toBe(0); // it can suffer greatly without dying
  });

  it('soft: but the truly forgotten fade at last — Lethe, without a star', () => {
    const { state, events } = advance(forsaken(), (LETHE_STEPS + 20) * SIM_STEP_MS);
    expect(state.alive).toBe(false);
    const out = events.find((e) => e.kind === 'lightWentOut');
    expect(out?.tag).toBe('lethe');
  });

  it('the fade is COUNTED, never sudden: interrupted neglect does not accumulate', () => {
    // Deeply neglected for most of the window — then a single act of care lands and
    // resets the count (the door back stays open to the very last step).
    const most = advance(forsaken(), (LETHE_STEPS - 10) * SIM_STEP_MS).state;
    expect(most.alive).toBe(true);
    expect(most.careHistory.neglectedSteps).toBeGreaterThan(0);
    const fed = interact(most, 'feed').state;
    expect(fed.careHistory.neglectedSteps).toBe(0);
    // The clock starts over — another short stretch of neglect does not fade it.
    const after = advance(fed, fed.lastTickAt + 100 * SIM_STEP_MS);
    expect(after.state.alive).toBe(true);
  });

  it('a soured-but-not-forsaken Yim never fades — only deep sustained abandonment does', () => {
    const base = condenseMote(7, 0);
    const lonelyButLoved: CreatureState = {
      ...base,
      disposition: -50, // a Yim, but not at the floor of the heart
      uncanny: true,
      stats: { ...base.stats, ambra: 0, affection: 0, security: 0 },
    };
    // Even with wellbeing at the floor, the heart above LETHE_DISPOSITION holds on…
    const { state } = advance(lonelyButLoved, 200 * SIM_STEP_MS);
    expect(state.alive).toBe(true);
  });

  it('a creature whose light has gone out does not tick further', () => {
    const dead = advance(filthy('classic'), 5000 * SIM_STEP_MS).state;
    const again = advance(dead, dead.lastTickAt + 1000 * SIM_STEP_MS);
    expect(again.state).toBe(dead);
    expect(again.events).toEqual([]);
  });
});
