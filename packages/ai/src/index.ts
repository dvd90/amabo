/**
 * @amabo/ai — the narration layer (docs/ARCHITECTURE.md §5).
 *
 * LAW 2: this package owns ONLY flavor. It turns engine state into the creature's
 * voice per the STORY.md §9 Narration Voice Guide. It is data-in / text-out and is
 * never trusted to mutate game state. The real Anthropic call, `record_life`
 * tool-use, zod validation, prompt caching, and the local fallback land in M6.
 */

/** Model tiering (CLAUDE.md): routine peeks are cheap, milestones get the richer model. */
export const MODEL_PEEK = 'claude-haiku-4-5' as const;
export const MODEL_MILESTONE = 'claude-sonnet-4-6' as const;

export type NarrateMode = 'peek' | 'milestone';

export interface NarrateOutput {
  journal: string;
  mood: string;
  newMemories?: { text: string; salience: number }[];
}

/**
 * Pick the model tier for a narration call: milestones (evolution, first souring,
 * multiply, graduation) get Sonnet; routine peeks get Haiku.
 */
export function modelFor(mode: NarrateMode): typeof MODEL_PEEK | typeof MODEL_MILESTONE {
  return mode === 'milestone' ? MODEL_MILESTONE : MODEL_PEEK;
}
