import { describe, expect, it } from 'vitest';
import { bassHz, inScale, pickFreq, ROOT_HZ, scaleFreqs } from './theory.js';

describe('music theory (generative soundtrack)', () => {
  it('Amabo is major-pentatonic, Yim is minor-pentatonic', () => {
    expect(inScale('amabo', 4)).toBe(true); // major third
    expect(inScale('amabo', 3)).toBe(false); // minor third — not in major pent
    expect(inScale('yim', 3)).toBe(true); // minor third
    expect(inScale('yim', 4)).toBe(false);
  });

  it('membership wraps across octaves', () => {
    expect(inScale('amabo', 16)).toBe(true); // 16 % 12 = 4
    expect(inScale('amabo', -8)).toBe(true); // -8 -> 4
  });

  it('every picked note is in scale (never atonal)', () => {
    const allowed = new Set(scaleFreqs('amabo').map((f) => f.toFixed(3)));
    for (let i = 0; i < 50; i++) {
      const f = pickFreq('amabo', i / 50);
      expect(allowed.has(f.toFixed(3))).toBe(true);
    }
  });

  it('the two moods sound different (different roots + scales)', () => {
    expect(ROOT_HZ.amabo).not.toBe(ROOT_HZ.yim);
    expect(scaleFreqs('amabo')).not.toEqual(scaleFreqs('yim'));
    expect(bassHz('amabo')).toBe(110);
  });
});
