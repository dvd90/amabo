/**
 * memories.ts — memory distillation (ARCHITECTURE.md §5, M7). We never resend the
 * whole journal; we keep only the top-N memories by salience plus recent events, so
 * the prompt stays roughly the same size no matter how old the creature gets.
 */

export interface Memory {
  text: string;
  salience: number;
}

/** ~8 keeps the prompt small while preserving the creature's strongest memories. */
export const MAX_MEMORIES = 8;

/** Highest-salience first, capped at `max`. Ties keep their original order (stable). */
export function selectMemories(memories: readonly Memory[], max: number = MAX_MEMORIES): Memory[] {
  return [...memories].sort((a, b) => b.salience - a.salience).slice(0, max);
}
