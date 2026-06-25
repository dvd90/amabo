import { describe, expect, it } from 'vitest';
import { condenseMote, summarizeGap, type CreatureState, type SimEvent } from './index.js';

const HOUR = 3_600_000;

function s(over: Partial<CreatureState> = {}): CreatureState {
  return { ...condenseMote(1, 0), ...over };
}
function stats(base: CreatureState, over: Partial<CreatureState['stats']>): CreatureState {
  return { ...base, stats: { ...base.stats, ...over } };
}
const grad: SimEvent = {
  at: 0,
  kind: 'graduation',
  statDeltas: {},
  dispositionDelta: 0,
  salience: 5,
};

describe('summarizeGap — the "while you were away" recap (M-A)', () => {
  it('reports elapsed time and a stage climb', () => {
    const g = summarizeGap(s(), s({ stage: 'spark' }), [], 2 * HOUR);
    expect(g.elapsedMinutes).toBe(120);
    expect(g.fromStage).toBe('mote');
    expect(g.toStage).toBe('spark');
    expect(g.highlights).toContain('grew');
  });

  it('clamps negative elapsed to zero', () => {
    expect(summarizeGap(s(), s(), [], -5000).elapsedMinutes).toBe(0);
  });

  it('graduation outranks a stage climb (and suppresses "grew")', () => {
    const g = summarizeGap(s({ stage: 'velveteen' }), s({ stage: 'bloom' }), [grad], HOUR);
    expect(g.highlights[0]).toBe('graduated');
    expect(g.highlights).not.toContain('grew');
  });

  it('flags souring and, separately, brightening (redemption)', () => {
    expect(
      summarizeGap(s({ uncanny: false }), s({ uncanny: true }), [], HOUR).highlights,
    ).toContain('soured');
    expect(
      summarizeGap(s({ uncanny: true }), s({ uncanny: false }), [], HOUR).highlights,
    ).toContain('brightened');
  });

  it('no disposition flag when uncanny is unchanged (either steady-bright or steady-soured)', () => {
    expect(summarizeGap(s(), s(), [], HOUR).highlights).not.toContain('soured');
    const bothYim = summarizeGap(s({ uncanny: true }), s({ uncanny: true }), [], HOUR).highlights;
    expect(bothYim).not.toContain('soured');
    expect(bothYim).not.toContain('brightened');
  });

  it('flags falling ill and recovering', () => {
    expect(summarizeGap(s({ ill: false }), s({ ill: true }), [], HOUR).highlights).toContain(
      'fellIll',
    );
    expect(summarizeGap(s({ ill: true }), s({ ill: false }), [], HOUR).highlights).toContain(
      'recovered',
    );
  });

  it('reads as rested when it ended asleep with energy held or recovered', () => {
    const before = stats(s(), { energy: 40 });
    const rested = summarizeGap(before, stats(s({ asleep: true }), { energy: 80 }), [], HOUR);
    expect(rested.highlights).toContain('rested');
    // Asleep but more tired than before → not "rested".
    const drained = summarizeGap(before, stats(s({ asleep: true }), { energy: 20 }), [], HOUR);
    expect(drained.highlights).not.toContain('rested');
    // Awake → not "rested".
    expect(summarizeGap(before, s(), [], HOUR).highlights).not.toContain('rested');
  });

  it('flags a dim (hungry) and a lonely return', () => {
    expect(summarizeGap(s(), stats(s(), { ambra: 10 }), [], HOUR).highlights).toContain('hungry');
    expect(summarizeGap(s(), stats(s(), { security: 12 }), [], HOUR).highlights).toContain(
      'lonely',
    );
  });

  it('reads as content when healthy, secure, and bonded', () => {
    const g = summarizeGap(s(), stats(s(), { affection: 75, ambra: 80, security: 65 }), [], HOUR);
    expect(g.highlights).toContain('content');
  });

  it('is not content when affection is low (even if otherwise fine)', () => {
    const g = summarizeGap(s(), stats(s(), { affection: 40, ambra: 80, security: 65 }), [], HOUR);
    expect(g.highlights).not.toContain('content');
  });

  it('reports only stat moves above the noise floor', () => {
    const g = summarizeGap(s(), stats(s(), { ambra: 40, security: 51 }), [], HOUR);
    expect(g.deltas.ambra).toBe(-30); // 70 → 40
    expect(g.deltas.security).toBeUndefined(); // 50 → 51 is below the floor
  });
});
