/**
 * llm.ts — which LLM speaks for the creatures (multi-LLM), built once from the
 * environment. Shared by the server (index.ts) and the notify cron, so the world
 * speaks with the same voice whether a Light is looking or not.
 *
 * Priority when several keys are set: NARRATOR_PROVIDER (llama|grok|anthropic)
 * decides; otherwise the first key found wins in this order — LLAMA_API_KEY
 * (Llama 3.3 70B, the current pick), XAI_API_KEY (Grok), ANTHROPIC_API_KEY
 * (Claude). No key → null, and callers use the local templated voice. Everything
 * downstream (metering, ledger, fallbacks) is provider-agnostic.
 */

import {
  makeAnthropicClient,
  makeGrokClient,
  makeOpenAiCompatClient,
  type AnthropicLike,
} from '@amabo/ai';
import type { Logger } from './logger.js';

export type LlmChoice = { client: AnthropicLike; provider: 'llama' | 'grok' | 'anthropic' };

export function buildLlmClient(logger: Logger): LlmChoice | null {
  const pick = process.env.NARRATOR_PROVIDER;
  // Deploy truth for the voice: one log line names the ids narration will use and
  // whether they came from the host's live /models list or straight from config.
  const onResolve = (info: { peek: string; milestone: string; via: string }) =>
    logger.child('narration').info('model ids resolved', info);
  const candidates: { provider: LlmChoice['provider']; make: () => AnthropicLike | null }[] = [
    {
      provider: 'llama',
      make: () => {
        const key = process.env.LLAMA_API_KEY;
        if (!key) return null;
        // Llama is open-weights: a HOST serves it. Default host is Groq (fast,
        // cheap, free tier) — point LLAMA_BASE_URL at Together/DeepInfra/Fireworks
        // etc. to switch hosts; every one speaks the same OpenAI-compatible dialect.
        // Verify current model ids at the host's docs — override via env.
        const model = process.env.LLAMA_MODEL ?? 'llama-3.3-70b-versatile';
        return makeOpenAiCompatClient({
          apiKey: key,
          baseUrl: process.env.LLAMA_BASE_URL ?? 'https://api.groq.com/openai/v1',
          peekModel: model,
          milestoneModel: process.env.LLAMA_MODEL_MILESTONE ?? model,
          onResolve,
          // Self-healing (like the Grok preset): if the host renamed the model,
          // resolve against its live /models list — a key alone stays enough.
          peekCandidates: [/llama-3\.3-70b/i, /llama-3\.3/i, /llama.*70b/i, /llama/i],
          milestoneCandidates: [/llama-3\.3-70b/i, /llama-3\.3/i, /llama.*70b/i, /llama/i],
        });
      },
    },
    {
      provider: 'grok',
      make: () => {
        const key = process.env.XAI_API_KEY;
        if (!key) return null;
        return makeGrokClient({
          apiKey: key,
          peekModel: process.env.XAI_MODEL_PEEK ?? 'grok-4-1-fast-non-reasoning',
          milestoneModel: process.env.XAI_MODEL_MILESTONE ?? 'grok-4-1-fast-reasoning',
          onResolve,
        });
      },
    },
    {
      provider: 'anthropic',
      make: () => {
        const key = process.env.ANTHROPIC_API_KEY;
        return key ? makeAnthropicClient(key) : null;
      },
    },
  ];
  const ordered = pick ? candidates.filter((c) => c.provider === pick) : candidates;
  for (const c of ordered) {
    const client = c.make();
    if (client) return { provider: c.provider, client };
  }
  return null;
}
