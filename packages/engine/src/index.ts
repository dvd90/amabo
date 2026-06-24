/**
 * @amabo/engine — the deterministic simulation core (docs/ARCHITECTURE.md §4).
 *
 * LAW 1: this package is PURE. No `pg`, no `@anthropic-ai/sdk`, no `Date.now()`,
 * no `Math.random()` — time and randomness are injected. It owns ALL game logic;
 * the AI never decides what happens.
 *
 * M1 (done): CreatureState, config tunables, seeded Rng, and `advance` (Ambra,
 * decay, the sleep cycle) with frame-rate-independent sim-step chunking.
 */

export * from './config.js';
export * from './math.js';
export * from './rng.js';
export * from './state.js';
export * from './events.js';
export * from './interact.js';
export * from './lifecycle.js';
export * from './advance.js';
