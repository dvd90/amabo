/**
 * narrate/port.ts — the narration boundary the API depends on. M5 ships a local,
 * templated fallback so `peek` works with zero AI; M6 provides an AI-backed narrator
 * (@amabo/ai) that satisfies the same port. The device therefore never shows an error
 * even when the model is unavailable (ARCHITECTURE.md §5).
 */

import type { CreatureState, SimEvent } from '@amabo/engine';

export interface NarrateContext {
  name: string;
  state: CreatureState;
  /** Distilled top-N memories to give the narrator continuity (M7). */
  memories?: { text: string; salience: number }[];
}

export interface NarrateOutput {
  journal: string;
  mood: string;
  newMemories?: { text: string; salience: number }[];
}

export interface Narrator {
  narrate(
    ctx: NarrateContext,
    events: SimEvent[],
    mode: 'peek' | 'milestone',
  ): Promise<NarrateOutput>;
}

/** A small, safe, voice-appropriate line built without any model call. */
export const localNarrator: Narrator = {
  async narrate(ctx) {
    const { state } = ctx;
    if (!state.alive) {
      return { journal: 'The glass is quiet now.', mood: 'still' };
    }
    if (state.uncanny) {
      return {
        journal: 'The clock stopped at the same soft hour again. I kept a light I do not have.',
        mood: 'longing',
      };
    }
    if (state.asleep) {
      return {
        journal: 'I held the warm spot by the wall and slept. It was alright.',
        mood: 'calm',
      };
    }
    return {
      journal: 'The day went soft and gold. I practiced being a rounder shape.',
      mood: 'content',
    };
  },
};
