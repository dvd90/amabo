import { describe, expect, it, vi } from 'vitest';
import { makeGrokClient } from './grok.js';
import { MODEL_MILESTONE, MODEL_PEEK } from './models.js';
import { narrate, type CreatureContext } from './narrate.js';

const CFG = {
  apiKey: 'xai-test',
  peekModel: 'grok-cheap',
  milestoneModel: 'grok-finer',
};

/** A canned OpenAI-style chat completion with one forced function call. */
function grokResponse(args: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: { name: 'record_life', arguments: JSON.stringify(args) },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 700, completion_tokens: 60 },
    }),
  };
}

const pip: CreatureContext = {
  name: 'Pip',
  stage: 'spark',
  disposition: 30,
  uncanny: false,
  asleep: false,
  alive: true,
};

describe('the Grok adapter (multi-LLM) — one port, another voice', () => {
  it('translates the Anthropic-shaped request into an xAI chat completion', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(grokResponse({ journal: 'a grok-written day', mood: 'content' }));
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);

    const out = await narrate({ context: pip, newEvents: [], mode: 'peek' }, client);
    expect(out.journal).toBe('a grok-written day');
    expect(out.usage).toEqual({ inputTokens: 700, outputTokens: 60 });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer xai-test');
    const body = JSON.parse(init.body as string);
    // Anthropic model ids are mapped to the configured Grok tier, never sent through.
    expect(body.model).toBe('grok-cheap');
    // The system blocks become one system message; the user turn carries the data.
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('Amarium');
    expect(body.messages[1].role).toBe('user');
    // The record_life tool is forced, OpenAI-function style.
    expect(body.tools[0].function.name).toBe('record_life');
    expect(body.tools[0].function.parameters.properties.journal).toBeTruthy();
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: 'record_life' } });
    expect(body.max_tokens).toBe(300);
  });

  it('routes milestones to the finer Grok model', async () => {
    const fetchFn = vi.fn().mockResolvedValue(grokResponse({ journal: 'x', mood: 'calm' }));
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    await client.messages.create({ model: MODEL_MILESTONE, max_tokens: 300, messages: [] });
    await client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body).model).toBe('grok-finer');
    expect(JSON.parse(fetchFn.mock.calls[1]![1].body).model).toBe('grok-cheap');
  });

  it('a failing till of words degrades to the local voice — never an error', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    const out = await narrate({ context: pip, newEvents: [], mode: 'peek' }, client);
    expect(out.journal.length).toBeGreaterThan(0); // fallbackNarration, not a throw
    expect(out.mood.length).toBeGreaterThan(0);
  });
});
