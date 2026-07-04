/**
 * grok.ts — the xAI preset over the generic OpenAI-compatible adapter (see
 * openai-compat.ts, which owns the translation). Kept as its own entry point so
 * provider wiring reads by name: makeGrokClient for xAI, makeOpenAiCompatClient
 * with a host baseUrl for open-weights models like Llama.
 */

import { makeOpenAiCompatClient, type OpenAiCompatConfig } from './openai-compat.js';
import type { AnthropicLike } from './narrate.js';

export type GrokConfig = Omit<OpenAiCompatConfig, 'baseUrl'> & { baseUrl?: string };

export function makeGrokClient(cfg: GrokConfig, fetchFn: typeof fetch = fetch): AnthropicLike {
  return makeOpenAiCompatClient({ ...cfg, baseUrl: cfg.baseUrl ?? 'https://api.x.ai/v1' }, fetchFn);
}
