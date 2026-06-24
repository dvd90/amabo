import { describe, expect, it } from 'vitest';
import { GRADUATION, MULTIPLY, SIM_STEP_MS } from './config.js';
import { advance } from './advance.js';
import {
  canGraduate,
  canMultiply,
  careTotal,
  graduate,
  multiply,
  nextStageFor,
} from './lifecycle.js';
import { condenseMote, type CreatureState } from './state.js';

/** A well-loved creature: lots of care banked, stats and disposition high. */
const wellLoved = (over: Partial<CreatureState> = {}): CreatureState => {
  const base = condenseMote(11, 0);
  return {
    ...base,
    careHistory: { fed: 40, cleaned: 40, played: 40, comforted: 40, neglectedSteps: 0 },
    ...over,
  };
};

describe('stage gates — the ladder of love (M4)', () => {
  it('nextStageFor opens only when age AND care are both enough', () => {
    expect(nextStageFor('mote', 0, 0)).toBeNull();
    expect(nextStageFor('mote', 60, 3)).toBe('spark');
    expect(nextStageFor('mote', 60, 2)).toBeNull(); // care short
    expect(nextStageFor('mote', 59, 3)).toBeNull(); // age short
    expect(nextStageFor('bloom', 999999, 999)).toBeNull(); // already at Bloom
  });

  it('scripted care climbs Mote → Spark → Velveteen → Bloom', () => {
    const { state, events } = advance(wellLoved(), 1500 * SIM_STEP_MS);
    expect(state.stage).toBe('bloom');
    const climbs = events.filter((e) => e.kind === 'evolved').map((e) => e.tag);
    expect(climbs).toEqual(['spark', 'velveteen', 'bloom']);
  });

  it('careTotal sums every kind of care', () => {
    expect(careTotal(wellLoved())).toBe(160);
  });
});

describe('graduation into Elysium (M4)', () => {
  const readyToGraduate = (): CreatureState =>
    wellLoved({
      stage: 'bloom',
      disposition: 90,
      ageMinutes: GRADUATION.ageMinutes + 100,
      stats: {
        ambra: 95,
        energy: 80,
        cleanliness: 100,
        health: 100,
        affection: 95,
        security: 90,
      },
    });

  it('advance emits a graduation milestone for a high-Amabo Bloom', () => {
    const { events } = advance(readyToGraduate(), SIM_STEP_MS);
    expect(events.some((e) => e.kind === 'graduation')).toBe(true);
  });

  it('graduate produces a valid, deterministic Star', () => {
    const c = readyToGraduate();
    const { star } = graduate(c, 'Mote-of-Eleven', 5_000_000);
    expect(star.name).toBe('Mote-of-Eleven');
    expect(star.graduatedAt).toBe(5_000_000);
    expect(star.finalTraits.disposition).toBe(90);
    expect(star.constellationPos).toEqual(graduate(c, 'x', 5_000_000).star.constellationPos);
  });

  it('a Yim cannot graduate — the door back must be walked first', () => {
    const yim = readyToGraduate();
    const soured: CreatureState = { ...yim, disposition: -40, uncanny: true };
    expect(canGraduate(soured)).toBe(false);
    expect(() => graduate(soured, 'no', 1)).toThrow();
    expect(advance(soured, SIM_STEP_MS).events.some((e) => e.kind === 'graduation')).toBe(false);
  });
});

describe('multiplying — the Symposium split (M4)', () => {
  const overflowing = (): CreatureState =>
    wellLoved({ stage: 'velveteen', stats: { ...condenseMote(11, 0).stats, ambra: 100 } });

  it('canMultiply needs a settled creature overflowing with Ambra', () => {
    expect(canMultiply(overflowing())).toBe(true);
    expect(
      canMultiply({
        ...overflowing(),
        stats: { ...overflowing().stats, ambra: MULTIPLY.ambra - 1 },
      }),
    ).toBe(false);
    expect(canMultiply({ ...overflowing(), stage: 'mote' })).toBe(false);
  });

  it('conserves Ambra (parent + child = the pre-split total)', () => {
    const before = overflowing();
    const { parent, child } = multiply(before);
    expect(parent.stats.ambra + child.stats.ambra).toBe(before.stats.ambra);
  });

  it('the child is a fresh Mote with its own seed and a sibling pull', () => {
    const { parent, child } = multiply(overflowing());
    expect(child.stage).toBe('mote');
    expect(child.ageMinutes).toBe(0);
    expect(child.alive).toBe(true);
    expect(child.seed).not.toBe(parent.seed);
    expect(child.traits.siblingPull).toBe(1);
    expect(parent.traits.siblingPull).toBe(1);
  });

  it('refuses to split a creature that is not ready', () => {
    expect(() => multiply(condenseMote(11, 0))).toThrow();
  });
});
