/**
 * narrate/symposium-ai.ts — adapt @amabo/ai's narrateSymposium() to the API's
 * SymposiumNarrator port. Used when ANTHROPIC_API_KEY is set; on any failure (or invalid
 * output) it degrades to the injected local narrator, so a gathering is always voiced.
 */

import { narrateSymposium, type AnthropicLike } from '@amabo/ai';
import type { SymposiumNarrator } from './symposium.js';

export function aiSymposiumNarrator(
  client: AnthropicLike,
  fallback: SymposiumNarrator,
): SymposiumNarrator {
  return {
    async narrate(ctx) {
      const out = await narrateSymposium(
        {
          participants: ctx.participants,
          topic: ctx.topic,
          outline: {
            connections: ctx.outline.connections,
            moments: ctx.outline.moments,
            outcomes: ctx.outline.outcomes.map((o) => ({
              id: o.id,
              warmed: o.warmed,
              comfortedById: o.comfortedById,
              bondedWith: o.bondedWith,
            })),
          },
        },
        client,
      );
      if (!out || out.transcript.length === 0) return fallback.narrate(ctx);
      return out.transcript;
    },
  };
}
