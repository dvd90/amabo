/**
 * flavor.ts — small, deterministic touches of life for the home screen (STORY.md §9, §11).
 * A "today" line (what the creature has quietly been up to) that rotates once a day, and
 * the Skin Horse — a gentle elder who tells a young creature how one becomes Real
 * (Velveteen Rabbit). Pure: keyed off the creature's seed + the calendar day, so it's
 * stable within a day and varies between creatures. The AI journal still owns the deep
 * voice; this just keeps the glass from ever feeling empty.
 */

import type { CreatureViewT } from '@amabo/shared';

const AMABO_TODAY = [
  'practiced being a rounder shape',
  'found the warm spot by the wall and stayed a while',
  'watched the light and waited, content',
  'hummed a small song with no words',
  'kept a little hope by the glass, in case you looked in',
  'turned its face toward where the warmth comes from',
];

const YIM_TODAY = [
  'wound the stopped clock, though it never starts',
  'kept a light it does not have',
  'sat with the quiet and did not run from it',
  'tried your shape, to see; it did not quite fit',
  'told the small dark bird it could stay',
  'waited at the same soft hour again',
];

const SKIN_HORSE = [
  'The Skin Horse says: you become Real by being loved a long, long time.',
  'The Skin Horse says: it doesn’t happen all at once. You become.',
  'The Skin Horse says: once you are Real, it lasts for always.',
];

function dayHash(seed: number, now: number): number {
  const day = Math.floor(now / 86_400_000);
  let x = (Math.abs(Math.trunc(seed)) + day * 2654435761) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  return x;
}

/** What the creature has quietly been up to today — its register follows its fate. */
export function todayLine(creature: CreatureViewT, now: number): string {
  const pool = creature.state.uncanny ? YIM_TODAY : AMABO_TODAY;
  return pool[dayHash(creature.state.seed, now) % pool.length]!;
}

/** The Skin Horse occasionally counsels a young creature (Mote/Spark); null otherwise. */
export function elderLine(creature: CreatureViewT, now: number): string | null {
  const young = creature.state.stage === 'mote' || creature.state.stage === 'spark';
  if (!young || !creature.state.alive) return null;
  const h = dayHash(creature.state.seed ^ 0x5eed, now);
  if (h % 3 !== 0) return null; // only some days
  return SKIN_HORSE[h % SKIN_HORSE.length]!;
}
