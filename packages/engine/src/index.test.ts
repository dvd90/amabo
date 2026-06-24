import { describe, expect, it } from 'vitest';
import { DISPOSITION_MAX, DISPOSITION_MIN } from '@amabo/shared';
import { clamp, clampDisposition } from './index.js';

describe('engine foundation (M0)', () => {
  it('clamp holds a value inside its inclusive range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('clampDisposition keeps the Amabo↔Yim axis within [-100, 100]', () => {
    expect(clampDisposition(0)).toBe(0);
    expect(clampDisposition(250)).toBe(DISPOSITION_MAX);
    expect(clampDisposition(-250)).toBe(DISPOSITION_MIN);
  });
});
