/**
 * eggs.ts — name easter eggs (STORY.md §11, §13). Naming a creature after one of the
 * public-domain touchstones quietly marks it with a nod to that story. Pure and
 * deterministic: a name maps to at most one egg, matched case-insensitively on a whole
 * word so ordinary names ("Robin", "Frank") don't trip a reference by accident.
 *
 * The marks are drawn by <Creature>; the lineage is the source works', the art is ours.
 */

export type NameEgg = 'velveteen' | 'pinocchio' | 'galatea' | 'frankenstein' | 'raven';

// First match wins; ordered most-specific first. Whole-word, case-insensitive.
const EGGS: Array<[RegExp, NameEgg]> = [
  [/\b(velveteen|skin\s*horse)\b/i, 'velveteen'], // Williams — becoming Real, worn soft
  [/\bpinocchio\b/i, 'pinocchio'], // Collodi — the made thing that earns a soul
  [/\b(galatea|pygmalion)\b/i, 'galatea'], // Ovid — the one who looks back
  [/\b(frankenstein|prometheus)\b/i, 'frankenstein'], // Shelley — made, not born
  [/\b(nevermore|lenore|raven)\b/i, 'raven'], // Poe — the perched bird of longing
];

/** The egg a name earns, or null. */
export function nameEgg(name: string): NameEgg | null {
  const n = name.trim();
  if (!n) return null;
  for (const [re, kind] of EGGS) if (re.test(n)) return kind;
  return null;
}
