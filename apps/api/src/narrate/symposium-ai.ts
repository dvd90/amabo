/**
 * narrate/symposium-ai.ts — adapt @amabo/ai's narrateSymposium() to the API's
 * SymposiumNarrator port. Used when an LLM key is set; on any failure (or invalid
 * output) it degrades to the injected local narrator, so a gathering is always
 * voiced — and the injected logger says so, because the device never will.
 */

import { narrateSymposium, type AnthropicLike } from '@amabo/ai';
import { noopLogger, type Logger } from '../logger.js';
import type { SymposiumNarrator } from './symposium.js';

export function aiSymposiumNarrator(
  client: AnthropicLike,
  fallback: SymposiumNarrator,
  logger: Logger = noopLogger,
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
      if (!out || out.transcript.length === 0) {
        logger.warn('symposium narration fell back to the local voice', {
          participants: ctx.participants.length,
          topic: ctx.topic ?? null,
        });
        return fallback.narrate(ctx);
      }
      return out.transcript;
    },
  };
}
