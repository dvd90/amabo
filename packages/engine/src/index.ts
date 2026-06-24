/**
 * @amabo/engine — the deterministic simulation core (docs/ARCHITECTURE.md §4).
 *
 * LAW 1: this package is PURE. No `pg`, no `@anthropic-ai/sdk`, no `Date.now()`,
 * no `Math.random()` — time and randomness are injected. It owns ALL game logic;
 * the AI never decides what happens. The real tick (`advance`), interactions,
 * multiply, and graduation land in M1+. M0 only establishes the pure foundation.
 */

import { DISPOSITION_MAX, DISPOSITION_MIN } from '@amabo/shared';

/** Clamp a value into an inclusive range. The engine's stats and disposition all live in bounds. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Keep disposition on the Amabo(+) ↔ Yim(−) axis within [−100, 100] (STORY.md §4). */
export function clampDisposition(value: number): number {
  return clamp(value, DISPOSITION_MIN, DISPOSITION_MAX);
}
