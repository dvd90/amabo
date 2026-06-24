/**
 * rng.ts — seeded randomness (ARCHITECTURE.md §4). The engine NEVER calls
 * `Math.random()`; all randomness is derived deterministically from a creature's
 * immutable `seed`. Event rolls (M2) will derive a per-step generator from
 * `(seed, stepIndex)` so the outcome is identical no matter how the catch-up is
 * chunked — the same frame-rate-independence invariant the tick already holds.
 */

/** A pure pseudo-random generator: each call returns the next value in [0, 1). */
export type Rng = () => number;

/** mulberry32 — a tiny, fast, well-distributed seedable PRNG. Deterministic per seed. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Mix a creature `seed` with a `salt` (e.g. an absolute step index) into a fresh,
 * well-spread sub-seed. Same inputs → same sub-seed, so rolls stay reproducible
 * regardless of how `advance` is chunked.
 */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed >>> 0) ^ Math.imul(salt >>> 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
