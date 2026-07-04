/**
 * narrate/ai.ts — adapt @amabo/ai's narrate() to the API's Narrator port. Used when
 * an LLM key is set; otherwise the localNarrator (port.ts) is the default so the app
 * runs with zero AI. The fallback inside narrate() is silent by design (the device
 * never sees an error) — the injected logger is how ops finds out it happened.
 */

import { narrate, type AnthropicLike } from '@amabo/ai';
import { noopLogger, type Logger } from '../logger.js';
import type { Narrator } from './port.js';

export function aiNarrator(client: AnthropicLike, logger: Logger = noopLogger): Narrator {
  return {
    async narrate(ctx, events, mode) {
      const out = await narrate(
        {
          context: {
            name: ctx.name,
            stage: ctx.state.stage,
            disposition: ctx.state.disposition,
            uncanny: ctx.state.uncanny,
            asleep: ctx.state.asleep,
            alive: ctx.state.alive,
            persona: ctx.persona ?? undefined,
          },
          newEvents: events.map((e) => ({ kind: e.kind, tag: e.tag, salience: e.salience })),
          mode,
          memories: ctx.memories,
        },
        client,
        {
          onFallback: (reason, err) =>
            logger.warn('model narration fell back to the local voice', {
              reason,
              mode,
              creature: ctx.name,
              err,
            }),
        },
      );
      return {
        journal: out.journal,
        mood: out.mood,
        newMemories: out.newMemories,
        usage: out.usage,
      };
    },
  };
}
