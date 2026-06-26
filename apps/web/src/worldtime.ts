/**
 * worldtime.ts — purely-presentational time & rarity helpers for world eggs
 * (STORY.md §11). The engine owns all *game* time; these only tint the glass and
 * never touch state. Kept pure (a Date / number in, a verdict out) so they're
 * deterministic and unit-testable.
 */

/** How the glass should feel at this wall-clock moment. */
export type NightMood = {
  /** Late evening through early morning: the world dims and cools. */
  night: boolean;
  /** The midnight hour: a shooting star may cross the glass. */
  witching: boolean;
};

export function nightMood(now: Date): NightMood {
  const h = now.getHours();
  return {
    night: h >= 20 || h < 6, // 8pm–6am
    witching: h === 0, // the midnight hour
  };
}

/**
 * A rare, deterministic shimmer some Motes are born with — a one-in-many iridescent
 * soul (the Blue Bird's hall of light). Pure hash of the seed, ~1 in 16, so a given
 * creature is always (or never) iridescent — it doesn't flicker between peeks.
 */
export function isIridescent(seed: number): boolean {
  let x = (Math.abs(Math.trunc(seed)) * 2654435761 + 40503) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  return x % 16 === 0;
}
