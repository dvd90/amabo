/**
 * narrate/ai.ts — adapt @amabo/ai's narrate() to the API's Narrator port. Used when
 * ANTHROPIC_API_KEY is set; otherwise the localNarrator (port.ts) is the default so
 * the app runs with zero AI.
 */

import { narrate, type AnthropicLike } from '@amabo/ai';
import type { Narrator } from './port.js';

export function aiNarrator(client: AnthropicLike): Narrator {
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
          },
          newEvents: events.map((e) => ({ kind: e.kind, tag: e.tag, salience: e.salience })),
          mode,
          memories: ctx.memories,
        },
        client,
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
