import { describe, expect, it } from 'vitest';
import { resonate, visitDelta } from './resonate.js';
import { mulberry32 } from './rng.js';
import { condenseMote, type CreatureState } from './state.js';

const at = (disposition: number): CreatureState => ({ ...condenseMote(1, 1000), disposition });

describe('resonate — a duet, never a duel (M9.5)', () => {
  it('is pure and deterministic for a given seed', () => {
    const a = at(50);
    const b = at(40);
    const r1 = resonate(a, b, mulberry32(99));
    const r2 = resonate(a, b, mulberry32(99));
    expect(r1).toEqual(r2);
  });

  it('close temperaments harmonize: both warm and drift toward each other', () => {
    const a = at(60);
    const b = at(40);
    const { events, deltasA, deltasB } = resonate(a, b, mulberry32(7));
    expect(events[0]!.tag).toBe('harmony');
    expect(deltasA.stats.affection!).toBeGreaterThan(0);
    expect(deltasB.stats.affection!).toBeGreaterThan(0);
    expect(deltasA.disposition).toBeLessThan(0); // a (60) drifts down toward b (40)
    expect(deltasB.disposition).toBeGreaterThan(0); // b (40) drifts up toward a (60)
  });

  it('far-apart temperaments clash gently — unsettling, never harmful', () => {
    const a = at(90);
    const b = at(-90);
    const { events, deltasA } = resonate(a, b, mulberry32(7));
    expect(events[0]!.tag).toBe('clash');
    expect(deltasA.stats.security!).toBeLessThan(0);
    expect(deltasA.stats.affection!).toBeGreaterThan(0); // still a trace of warmth
  });

  it('a visit is a small, will-preserving warmth', () => {
    const d = visitDelta();
    expect(d.stats.affection!).toBeGreaterThan(0);
    expect(d.stats.security!).toBeGreaterThan(0);
    expect(d.disposition).toBe(0);
  });

  it('matches the recorded snapshot', () => {
    expect(resonate(at(20), at(10), mulberry32(2024))).toMatchSnapshot();
  });
});
