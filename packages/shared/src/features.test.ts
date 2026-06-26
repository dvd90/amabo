import { describe, expect, it } from 'vitest';
import {
  FEATURE_DEFAULTS,
  FEATURE_KEYS,
  FeaturesSchema,
  featureEnvVar,
  resolveFeatures,
} from './features.js';

describe('feature flags (optional layers are OFF by default)', () => {
  it('every known flag defaults to false', () => {
    for (const key of FEATURE_KEYS) expect(FEATURE_DEFAULTS[key]).toBe(false);
    expect(FeaturesSchema.parse(FEATURE_DEFAULTS)).toEqual(FEATURE_DEFAULTS);
  });

  it('resolves to all-off with an empty environment', () => {
    expect(resolveFeatures({})).toEqual(FEATURE_DEFAULTS);
    expect(resolveFeatures()).toEqual(FEATURE_DEFAULTS);
  });

  it('maps a flag to its AMABO_FEATURE_* env var (camelCase → SNAKE)', () => {
    expect(featureEnvVar('chain')).toBe('AMABO_FEATURE_CHAIN');
    expect(featureEnvVar('selfTending')).toBe('AMABO_FEATURE_SELF_TENDING');
  });

  it('turns a flag on only for truthy values, case-insensitively', () => {
    for (const v of ['1', 'true', 'on', 'yes', 'YES', 'On', ' true ']) {
      expect(resolveFeatures({ AMABO_FEATURE_SELF_TENDING: v }).selfTending).toBe(true);
    }
  });

  it('leaves a flag off for falsey or garbage values', () => {
    for (const v of ['0', 'false', '', 'no', 'maybe', 'off']) {
      expect(resolveFeatures({ AMABO_FEATURE_SELF_TENDING: v }).selfTending).toBe(false);
    }
  });

  it('resolves flags independently', () => {
    const f = resolveFeatures({ AMABO_FEATURE_CHAIN: '1' });
    expect(f.chain).toBe(true);
    expect(f.selfTending).toBe(false); // the Dreaming stays off unless explicitly enabled
  });
});
