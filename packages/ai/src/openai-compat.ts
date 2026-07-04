/**
 * openai-compat.ts — one adapter, many voices (multi-LLM). Most non-Anthropic
 * providers — xAI's Grok, and every host serving open-weights models like Meta's
 * Llama (Groq, Together, DeepInfra, Fireworks…) — speak the same OpenAI-compatible
 * chat-completions dialect. This adapter translates the app's Anthropic-shaped port
 * (AnthropicLike: system blocks, a forced tool, tool_use content) to and from it,
 * so narrate()/narrateSymposium() and the metering stack (LAUNCH_PLAN.md L3) work
 * unchanged whichever provider is behind the port.
 *
 * Plain fetch, no SDK — same spirit as the API's monitor.ts and stripe.ts. Anthropic
 * model ids arriving through the port are MAPPED to the configured tiers, never sent
 * through. Any HTTP failure throws; narrate() already catches and falls back to the
 * local voice, so the creature never goes mute.
 */

import { MODEL_MILESTONE } from './models.js';
import type { AnthropicLike } from './narrate.js';

export interface OpenAiCompatConfig {
  apiKey: string;
  /** The provider's OpenAI-compatible root, e.g. `https://api.groq.com/openai/v1`. */
  baseUrl: string;
  /** The cheap tier — routine peeks. */
  peekModel: string;
  /** The finer tier — milestones (evolution, first souring, graduation, symposium). */
  milestoneModel: string;
  /**
   * Ordered fallbacks matched against the host's live `GET /models` list when the
   * configured id isn't served (providers rename models; a key alone should be
   * enough). The configured id always wins when it exists; matching skips
   * image/embedding/audio models; resolution happens once per process and any
   * failure quietly keeps the configured ids.
   */
  peekCandidates?: RegExp[];
  milestoneCandidates?: RegExp[];
  /**
   * Called once, after model resolution — so the composition root can log which ids
   * narration will actually use and whether they came from the host's live list
   * ('live-list') or straight from config ('configured', i.e. /models unavailable).
   * A throwing hook is swallowed; observation never breaks the voice.
   */
  onResolve?: (info: { peek: string; milestone: string; via: 'live-list' | 'configured' }) => void;
}

/** Never narrate through a non-text model, whatever the candidates say. */
const NON_TEXT = /image|embed|audio|vision|whisper|tts|guard|moderation/i;

function pickModel(configured: string, available: string[], candidates: RegExp[]): string {
  if (available.includes(configured)) return configured;
  const text = available.filter((id) => !NON_TEXT.test(id));
  for (const pattern of candidates) {
    const hit = text.find((id) => pattern.test(id));
    if (hit) return hit;
  }
  return configured;
}

/** The slice of the port's request body this adapter understands. */
interface PortBody {
  model?: string;
  max_tokens?: number;
  system?: string | { type: string; text: string }[];
  tools?: { name: string; description?: string; input_schema: Record<string, unknown> }[];
  tool_choice?: { type: string; name?: string };
  messages?: { role: string; content: string }[];
}

export function makeOpenAiCompatClient(
  cfg: OpenAiCompatConfig,
  fetchFn: typeof fetch = fetch,
): AnthropicLike {
  const root = cfg.baseUrl.replace(/\/$/, '');
  const endpoint = `${root}/chat/completions`;

  // Resolve the tier ids against the host's live model list — once, lazily, and
  // never fatally: a host without /models (or a failing call) keeps the configured
  // ids exactly as before.
  let resolved: Promise<{ peek: string; milestone: string }> | null = null;
  const tellResolved = (
    models: { peek: string; milestone: string },
    via: 'live-list' | 'configured',
  ) => {
    try {
      cfg.onResolve?.({ ...models, via });
    } catch {
      /* observation never breaks the voice */
    }
    return models;
  };
  const resolveModels = () => {
    resolved ??= (async () => {
      try {
        const res = await fetchFn(`${root}/models`, {
          headers: { authorization: `Bearer ${cfg.apiKey}` },
        });
        if (!res.ok) throw new Error(`models → ${res.status}`);
        const data = (await res.json()) as { data?: { id?: string }[] };
        const available = (data.data ?? []).map((m) => m.id).filter((id): id is string => !!id);
        if (available.length === 0) throw new Error('empty model list');
        return tellResolved(
          {
            peek: pickModel(cfg.peekModel, available, cfg.peekCandidates ?? []),
            milestone: pickModel(cfg.milestoneModel, available, cfg.milestoneCandidates ?? []),
          },
          'live-list',
        );
      } catch {
        return tellResolved({ peek: cfg.peekModel, milestone: cfg.milestoneModel }, 'configured');
      }
    })();
    return resolved;
  };

  return {
    messages: {
      async create(rawBody: unknown) {
        const body = rawBody as PortBody;
        const models = await resolveModels();

        // System blocks (with their cache_control hints) flatten to one system turn.
        const system = Array.isArray(body.system)
          ? body.system.map((b) => b.text).join('\n\n')
          : (body.system ?? '');
        const messages: { role: string; content: string }[] = [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...(body.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
        ];

        // Anthropic tool definitions → OpenAI function definitions; the forced
        // tool_choice carries over so structured output stays guaranteed-shaped.
        const tools = (body.tools ?? []).map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.input_schema },
        }));
        const toolChoice =
          body.tool_choice?.type === 'tool' && body.tool_choice.name
            ? { type: 'function', function: { name: body.tool_choice.name } }
            : undefined;

        const res = await fetchFn(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${cfg.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: body.model === MODEL_MILESTONE ? models.milestone : models.peek,
            max_tokens: body.max_tokens,
            messages,
            ...(tools.length > 0 ? { tools } : {}),
            ...(toolChoice ? { tool_choice: toolChoice } : {}),
          }),
        });
        if (!res.ok) {
          // Keep the provider's own words — a bare status hides WHY (wrong model id,
          // unsupported param…); the API layer logs this message via onFallback.
          let detail = '';
          try {
            detail = (await (res as { text?: () => Promise<string> }).text?.()) ?? '';
          } catch {
            /* a body we cannot read is just a bare status */
          }
          throw new Error(
            `llm chat/completions → ${res.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`,
          );
        }

        const data = (await res.json()) as {
          choices?: {
            message?: {
              content?: string | null;
              tool_calls?: { type: string; function?: { name: string; arguments: string } }[];
            };
          }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        // Function calls → Anthropic tool_use blocks (arguments arrive as a JSON
        // string; a malformed one becomes undefined input, which the callers'
        // zod safeParse turns into the local fallback line).
        const message = data.choices?.[0]?.message;
        const content: { type: string; name?: string; input?: unknown; text?: string }[] = [];
        for (const call of message?.tool_calls ?? []) {
          if (call.type !== 'function' || !call.function) continue;
          let input: unknown;
          try {
            input = JSON.parse(call.function.arguments);
          } catch {
            input = undefined;
          }
          content.push({ type: 'tool_use', name: call.function.name, input });
        }
        if (typeof message?.content === 'string' && message.content.length > 0) {
          content.push({ type: 'text', text: message.content });
        }

        return {
          content,
          usage: {
            input_tokens: data.usage?.prompt_tokens,
            output_tokens: data.usage?.completion_tokens,
          },
        };
      },
    },
  };
}
