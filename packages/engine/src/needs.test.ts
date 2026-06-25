import { describe, expect, it } from 'vitest';
import { condenseMote, needs, type CreatureState } from './index.js';

function s(over: Partial<CreatureState> = {}): CreatureState {
  return { ...condenseMote(1, 0), ...over };
}
function stats(base: CreatureState, over: Partial<CreatureState['stats']>): CreatureState {
  return { ...base, stats: { ...base.stats, ...over } };
}

describe('needs — the dashboard urgency signals (M-B)', () => {
  it('a fresh, well creature needs nothing urgent', () => {
    expect(needs(s())).toEqual([]);
  });

  it('flags a dim (hungry) creature', () => {
    expect(needs(stats(s(), { ambra: 10 }))).toContain('hungry');
  });

  it('flags illness and sleep', () => {
    expect(needs(s({ ill: true }))).toContain('ill');
    expect(needs(s({ asleep: true }))).toContain('asleep');
  });

  it('flags souring (a Yim presentation)', () => {
    expect(needs(s({ uncanny: true }))).toContain('souring');
  });

  it('flags loneliness when security is low', () => {
    expect(needs(stats(s(), { security: 12 }))).toContain('lonely');
  });

  it('flags a radiant Bloom as ready to ascend — but only a Bloom, and only if radiant', () => {
    expect(needs(s({ stage: 'bloom', disposition: 90 }))).toContain('ready');
    expect(needs(s({ stage: 'bloom', disposition: 10 }))).not.toContain('ready');
    expect(needs(s({ stage: 'velveteen', disposition: 90 }))).not.toContain('ready');
  });

  it('a creature whose light went out reads only as fading', () => {
    expect(needs(s({ alive: false }))).toEqual(['fading']);
  });
});
