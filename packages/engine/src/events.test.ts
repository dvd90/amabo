import { describe, expect, it } from 'vitest';
import { AMBIENT_NEUTRAL, pickWeighted, type AmbientDef } from './events.js';

describe('pickWeighted (M2)', () => {
  const table: readonly AmbientDef[] = [
    { tag: 'a', weight: 1, salience: 1 },
    { tag: 'b', weight: 1, salience: 1 },
    { tag: 'c', weight: 2, salience: 1 },
  ];

  it('returns the first bucket for a low roll', () => {
    expect(pickWeighted(table, 0).tag).toBe('a');
  });

  it('returns the last bucket for a high roll', () => {
    expect(pickWeighted(table, 0.999).tag).toBe('c');
  });

  it('respects the weight boundaries', () => {
    // total weight 4: a=[0,0.25) b=[0.25,0.5) c=[0.5,1)
    expect(pickWeighted(table, 0.3).tag).toBe('b');
    expect(pickWeighted(table, 0.6).tag).toBe('c');
  });

  it('the neutral table is non-empty', () => {
    expect(AMBIENT_NEUTRAL.length).toBeGreaterThan(0);
  });
});
