import { DISPOSITION_MAX, DISPOSITION_MIN } from '@amabo/shared';

/** Clamp a value into an inclusive range. Stats and disposition all live in bounds. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Keep disposition on the Amabo(+) ↔ Yim(−) axis within [−100, 100] (STORY.md §4). */
export function clampDisposition(value: number): number {
  return clamp(value, DISPOSITION_MIN, DISPOSITION_MAX);
}
