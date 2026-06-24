import { describe, expect, it } from 'vitest';
import { deriveSeed, mulberry32 } from './rng.js';

describe('seeded Rng (M1)', () => {
  it('is deterministic: same seed → same sequence', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('returns values in [0, 1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds produce different streams', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('deriveSeed is deterministic and varies with seed and salt', () => {
    expect(deriveSeed(42, 7)).toBe(deriveSeed(42, 7));
    expect(deriveSeed(42, 7)).not.toBe(deriveSeed(42, 8));
    expect(deriveSeed(42, 7)).not.toBe(deriveSeed(43, 7));
  });
});
