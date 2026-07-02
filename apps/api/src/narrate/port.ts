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
  /** The Light being narrated for — the meter (L3) charges its allowance. */
  ownerId?: string | null;
}

export interface NarrateOutput {
  journal: string;
  mood: string;
  newMemories?: { text: string; salience: number }[];
  /** Token accounting from a model call (absent on templated lines) — the ledger (L3). */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface Narrator {
  narrate(
    ctx: NarrateContext,
    events: SimEvent[],
    mode: 'peek' | 'milestone',
  ): Promise<NarrateOutput>;
}

/**
 * A varied, event-driven, voice-appropriate diary built without any model call — the
 * launch-time voice for a keyless deploy. The pools + register logic live in `local.ts`;
 * re-exported here so the long-standing `narrate/port.js` import keeps working.
 */
export { localNarrator } from './local.js';
