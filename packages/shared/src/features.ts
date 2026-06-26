/**
 * features.ts — feature flags for the optional, peripheral layers. EVERY flag is OFF
 * by default: the app builds, ships, and is fully playable with all of them false.
 * Optional layers (the Exchange — STORY.md §7½ / ARCHITECTURE.md §13; the Dreaming —
 * STORY.md §7⅞ / ARCHITECTURE.md §17) stay completely unreachable until a deployment
 * turns them on.
 *
 * Pure: an environment map goes in, resolved flags come out, so flags are testable and
 * the core never reaches into `process.env` directly.
 */

import { z } from 'zod';

/** The known flags. Add a layer's umbrella flag here (and keep it false by default). */
export const FEATURE_KEYS = ['chain', 'selfTending'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type Features = Record<FeatureKey, boolean>;

/**
 * The default posture: everything off. `chain` gates the Exchange (crypto keepsakes);
 * `selfTending` gates the Dreaming (a grown creature *proposing* improvements to itself
 * and its world — always human-reviewed, never auto-applied). See docs/SELF_TENDING.md.
 */
export const FEATURE_DEFAULTS: Features = {
  chain: false,
  selfTending: false,
};

export const FeaturesSchema = z.object({
  chain: z.boolean(),
  selfTending: z.boolean(),
});

const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

/** The env var that toggles a flag, e.g. `selfTending` → `AMABO_FEATURE_SELF_TENDING`. */
export function featureEnvVar(key: FeatureKey): string {
  const snake = key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();
  return `AMABO_FEATURE_${snake}`;
}

/**
 * Resolve flags from an environment map. A flag is on only when its env var is set to a
 * truthy value ('1' / 'true' / 'on' / 'yes', case-insensitive); anything else — unset,
 * empty, 'false', '0', or garbage — leaves the default (off).
 */
export function resolveFeatures(env: Record<string, string | undefined> = {}): Features {
  const out: Features = { ...FEATURE_DEFAULTS };
  for (const key of FEATURE_KEYS) {
    const raw = env[featureEnvVar(key)];
    if (raw != null && TRUTHY.has(raw.trim().toLowerCase())) out[key] = true;
  }
  return out;
}
