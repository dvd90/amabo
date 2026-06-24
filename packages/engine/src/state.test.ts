import { describe, expect, it } from 'vitest';
import { condenseMote } from './state.js';

describe('condenseMote (M1)', () => {
  it('condenses a fresh Mote: neutral, rested, full of light', () => {
    const m = condenseMote(777, 1000);
    expect(m.seed).toBe(777);
    expect(m.stage).toBe('mote');
    expect(m.disposition).toBe(0);
    expect(m.ageMinutes).toBe(0);
    expect(m.alive).toBe(true);
    expect(m.uncanny).toBe(false);
    expect(m.asleep).toBe(false);
    expect(m.lastTickAt).toBe(1000);
  });

  it('starts every stat inside [0, 100]', () => {
    const { stats } = condenseMote(1, 0);
    for (const v of Object.values(stats)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
