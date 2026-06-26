/**
 * scenery.ts — a deterministic little world for each creature (STORY.md §2: a sealed
 * glass landscape). From the creature's seed we lay out a handful of props along the
 * ground — every creature always gets the *same* scene, but no two seeds look alike.
 * An Amabo grows warm, whimsical country (trees, a cottage, flowers); a Yim's glass is
 * Satis House in miniature (bare trees, a ruin, headstones). Pure: seed in, layout out.
 */

export type AmaboProp = 'leafy' | 'pine' | 'house' | 'bush' | 'rock' | 'flower';
export type YimProp = 'deadtree' | 'ruin' | 'grave' | 'deadbush' | 'rock';
export type PropKind = AmaboProp | YimProp;

export type SceneProp = {
  kind: PropKind;
  /** horizontal position, 0–100 across the glass */
  x: number;
  /** 0 (far, small, pale) … 1 (near, big, dark) */
  depth: number;
  /** mirror the prop so repeats don't look identical */
  flip: boolean;
};

const AMABO_KINDS: AmaboProp[] = ['leafy', 'pine', 'house', 'bush', 'rock', 'flower'];
const YIM_KINDS: YimProp[] = ['deadtree', 'ruin', 'grave', 'deadbush', 'rock'];

/** Tiny deterministic LCG seeded off the creature (no Math.random — same shape as the sprite's). */
function rng(seed: number) {
  let x = (Math.abs(Math.trunc(seed)) * 2654435761 + 12345) >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/**
 * Build the scene for a creature. Props are spread across the width in rough slots (so
 * they don't pile up) with per-slot jitter, depth and mirroring. 4–6 props keeps a small
 * LCD readable. The far ones are drawn first by the renderer so near ones overlap them.
 */
export function buildScene(seed: number, uncanny: boolean): SceneProp[] {
  const next = rng(seed * 7 + (uncanny ? 101 : 13));
  const kinds = uncanny ? YIM_KINDS : AMABO_KINDS;
  const count = 5 + Math.floor(next() * 3); // 5–7
  const props: SceneProp[] = [];
  for (let i = 0; i < count; i++) {
    const slot = ((i + 0.5) / count) * 88 + 6; // even-ish spread, 6..94
    const x = Math.max(4, Math.min(96, slot + (next() - 0.5) * 12));
    const depth = next();
    const kind = kinds[Math.floor(next() * kinds.length)]!;
    const flip = next() < 0.5;
    props.push({ kind, x, depth, flip });
  }
  // Sort far→near so the renderer paints back-to-front.
  return props.sort((a, b) => a.depth - b.depth);
}
