import { describe, expect, it } from 'vitest';
import type { Stage } from '@amabo/shared';
import { gather, type GatherParticipant } from './gather.js';
import { mulberry32 } from './rng.js';
import type { CreatureState } from './index.js';

function st(over: Partial<CreatureState> = {}): CreatureState {
  return {
    seed: 1,
    stage: 'bloom',
    disposition: 0,
    ageMinutes: 0,
    stats: { ambra: 60, energy: 80, cleanliness: 100, health: 100, affection: 50, security: 50 },
    asleep: false,
    ill: false,
    uncanny: false,
    alive: true,
    mortality: 'soft',
    traits: {},
    careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
    lastTickAt: 1000,
    ...over,
  };
}
const p = (id: string, over: Partial<CreatureState> = {}): GatherParticipant => ({
  id,
  state: st(over),
});
const rng = () => mulberry32(7);

describe('gather (the Symposium)', () => {
  it('two close temperaments harmonise, bond, and both come away warmer', () => {
    const r = gather([p('a', { disposition: 10 }), p('b', { disposition: 20 })], rng());
    expect(r.connections).toEqual([{ a: 'a', b: 'b', kind: 'harmony' }]);
    expect(r.bonds).toHaveLength(1);
    expect(r.events).toHaveLength(2);
    for (const o of r.outcomes) expect(o.delta.stats.affection!).toBeGreaterThan(0);
    expect(r.outcomes.every((o) => o.bondedWith.length === 1)).toBe(true);
  });

  it('two distant temperaments clash gently — no bond, but a trace of warmth remains', () => {
    const r = gather([p('a', { disposition: 80 }), p('b', { disposition: -80 })], rng());
    expect(r.connections[0]!.kind).toBe('clash');
    expect(r.bonds).toHaveLength(0);
    expect(r.outcomes[0]!.delta.stats.security!).toBeLessThan(0); // a touch less settled
    expect(r.outcomes[0]!.delta.stats.affection!).toBeGreaterThan(0); // never zero warmth
    expect(r.outcomes.every((o) => o.warmed === false)).toBe(true);
  });

  it('warm company draws a Yim back toward the light — comforted by its brightest friend', () => {
    // the Yim sits first so it harmonises with each companion in turn; the brightest
    // (disposition 0) is the one named as having drawn it out, even mid-list.
    const r = gather(
      [
        p('yim', { disposition: -35 }),
        p('a', { disposition: -15 }),
        p('b', { disposition: 0 }),
        p('c', { disposition: -20 }),
      ],
      rng(),
    );
    const yim = r.outcomes.find((o) => o.id === 'yim')!;
    expect(yim.warmed).toBe(true);
    expect(yim.comfortedById).toBe('b'); // brightest harmonising companion
    expect(yim.delta.disposition).toBeGreaterThan(0); // pulled up, plus the company comfort
    expect(r.outcomes.filter((o) => o.warmed)).toHaveLength(1); // companions aren't "warmed"
  });

  it('a settled elder sitting with a Mote is a mentoring moment (the Skin Horse), elder first', () => {
    const forward = gather([p('elder', { disposition: 60 }), p('mote', { stage: 'mote' })], rng());
    expect(forward.moments).toContainEqual({ tag: 'mentor', participants: ['elder', 'mote'] });
    // order of inputs doesn't matter — the elder is always named first
    const reversed = gather([p('mote', { stage: 'mote' }), p('elder', { disposition: 60 })], rng());
    expect(reversed.moments).toContainEqual({ tag: 'mentor', participants: ['elder', 'mote'] });
  });

  it('a much fuller creature passes some Ambra hand to hand', () => {
    const r = gather(
      [
        p('full', { stage: 'spark', disposition: 20, stats: { ...st().stats, ambra: 95 } }),
        p('low', { stage: 'spark', disposition: 20, stats: { ...st().stats, ambra: 40 } }),
      ],
      rng(),
    );
    expect(r.moments).toContainEqual({ tag: 'shareAmbra', participants: ['full', 'low'] });

    // the giver is always named first, whichever order they sat down in
    const reversed = gather(
      [
        p('low', { stage: 'spark', disposition: 20, stats: { ...st().stats, ambra: 40 } }),
        p('full', { stage: 'spark', disposition: 20, stats: { ...st().stats, ambra: 95 } }),
      ],
      rng(),
    );
    expect(reversed.moments).toContainEqual({ tag: 'shareAmbra', participants: ['full', 'low'] });
  });

  it('two bright, grown creatures simply play', () => {
    const r = gather(
      [p('a', { stage: 'bloom', disposition: 50 }), p('b', { stage: 'bloom', disposition: 50 })],
      rng(),
    );
    expect(r.moments).toContainEqual({ tag: 'play', participants: ['a', 'b'] });
  });

  it('a quiet pair of Motes shares no special moment', () => {
    const r = gather([p('a', { stage: 'mote' }), p('b', { stage: 'mote' })], rng());
    expect(r.moments).toHaveLength(0);
  });

  it('averages gains across the company, so a crowd never balloons the reward', () => {
    const pair = gather([p('a', { disposition: 10 }), p('b', { disposition: 15 })], rng());
    const crowd = gather(
      [
        p('a', { disposition: 10 }),
        p('b', { disposition: 15 }),
        p('c', { disposition: 12 }),
        p('d', { disposition: 8 }),
      ],
      rng(),
    );
    const aPair = pair.outcomes[0]!.delta.stats.affection!;
    const aCrowd = crowd.outcomes[0]!.delta.stats.affection!;
    // being among three friends is not three times a single meeting — it's averaged.
    expect(aCrowd).toBeLessThan(aPair * 1.6);
    expect(aCrowd).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const make = () => gather([p('a', { disposition: 10 }), p('b', { disposition: 20 })], rng());
    expect(make()).toEqual(make());
  });

  it('handles a varied larger gathering without harm to anyone', () => {
    const stages: Stage[] = ['mote', 'spark', 'velveteen', 'bloom'];
    const party = stages.map((stage, i) => p(`c${i}`, { stage, disposition: i * 20 - 30 }));
    const r = gather(party, rng());
    expect(r.outcomes).toHaveLength(4);
    expect(r.events).toHaveLength(4);
    // nobody's security is driven down catastrophically — a gathering is never a duel
    for (const o of r.outcomes) {
      expect(Math.abs(o.delta.stats.security ?? 0)).toBeLessThan(10);
    }
  });
});
