import { describe, expect, it } from 'vitest';
import { isIridescent, nightMood } from './worldtime.js';

const at = (h: number) => new Date(2026, 0, 1, h, 0, 0);

describe('nightMood (world & time eggs, STORY.md §11)', () => {
  it('is night in the late evening and early morning, day in between', () => {
    expect(nightMood(at(22)).night).toBe(true);
    expect(nightMood(at(3)).night).toBe(true);
    expect(nightMood(at(13)).night).toBe(false);
    expect(nightMood(at(7)).night).toBe(false);
    expect(nightMood(at(19)).night).toBe(false);
    expect(nightMood(at(20)).night).toBe(true);
  });

  it('flags the witching (midnight) hour for a shooting star', () => {
    expect(nightMood(at(0)).witching).toBe(true);
    expect(nightMood(at(1)).witching).toBe(false);
    expect(nightMood(at(23)).witching).toBe(false);
  });
});

describe('isIridescent (a rare, stable shimmer)', () => {
  it('is deterministic for a given seed', () => {
    expect(isIridescent(7)).toBe(isIridescent(7));
    expect(isIridescent(123456)).toBe(isIridescent(123456));
  });

  it('is rare but does occur across many seeds (~1 in 16)', () => {
    let hits = 0;
    for (let s = 0; s < 1600; s++) if (isIridescent(s)) hits++;
    expect(hits).toBeGreaterThan(20); // far from 0
    expect(hits).toBeLessThan(300); // far from all
  });
});
