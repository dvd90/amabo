/**
 * The wall clock and the seed source live HERE, at the edge (ARCHITECTURE.md §7).
 * The pure engine never sees them — it is handed `now` and a fixed seed. Injecting
 * both makes every handler deterministic under test.
 */

export type Clock = () => number;
export const systemClock: Clock = () => Date.now();

/** Produces the immutable seed for a new creature. */
export type SeedSource = () => number;
export const randomSeed: SeedSource = () => Math.floor(Math.random() * 0xffffffff);
