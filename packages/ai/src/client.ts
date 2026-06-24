/**
 * client.ts — the real Anthropic client, adapted to the structural AnthropicLike port
 * so production code depends on the port, not the SDK. Built at the edge from the API
 * key; never imported by the engine.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AnthropicLike } from './narrate.js';

export function makeAnthropicClient(apiKey: string): AnthropicLike {
  const client = new Anthropic({ apiKey });
  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: (body: unknown) => client.messages.create(body as any) as any,
    },
  };
}
