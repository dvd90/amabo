/**
 * sprite.ts — LCD glow helper. The creature itself is now drawn as SVG (Creature.tsx);
 * this just maps ambient Ambra to the amber glow intensity (STORY.md §10).
 */

import type { CreatureViewT } from '@amabo/shared';

/** Amber LCD glow intensity (0..1) from ambient Ambra. */
export function glow(creature: CreatureViewT): number {
  return Math.max(0, Math.min(1, creature.state.stats.ambra / 100));
}
