/**
 * models.ts — model tiering (CLAUDE.md). Routine peeks use the cheap model; milestones
 * (evolution, first souring, multiply, graduation) get the richer one. Opus unneeded.
 */

export const MODEL_PEEK = 'claude-haiku-4-5' as const;
export const MODEL_MILESTONE = 'claude-sonnet-4-6' as const;

export type NarrateMode = 'peek' | 'milestone';

export function modelFor(mode: NarrateMode): typeof MODEL_PEEK | typeof MODEL_MILESTONE {
  return mode === 'milestone' ? MODEL_MILESTONE : MODEL_PEEK;
}
