import { describe, expect, it, vi } from 'vitest';
import { makeGrokClient } from './grok.js';
import { makeOpenAiCompatClient } from './openai-compat.js';
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

    const [url, init] = fetchFn.mock.calls.find(([u]) => String(u).endsWith('/chat/completions'))!;
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
    const chat = fetchFn.mock.calls.filter(([u]) => String(u).endsWith('/chat/completions'));
    expect(JSON.parse(chat[0]![1].body).model).toBe('grok-finer');
    expect(JSON.parse(chat[1]![1].body).model).toBe('grok-cheap');
  });

  it('serves open-weights hosts too: Llama 3.3 70B on a custom base URL', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(grokResponse({ journal: 'a llama-written day', mood: 'warm' }));
    const client = makeOpenAiCompatClient(
      {
        apiKey: 'gsk-test',
        baseUrl: 'https://api.groq.com/openai/v1/',
        peekModel: 'llama-3.3-70b-versatile',
        milestoneModel: 'llama-3.3-70b-versatile',
      },
      fetchFn as unknown as typeof fetch,
    );
    const out = await narrate({ context: pip, newEvents: [], mode: 'peek' }, client);
    expect(out.journal).toBe('a llama-written day');
    const [url, init] = fetchFn.mock.calls.find(([u]) => String(u).endsWith('/chat/completions'))!;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions'); // trailing / trimmed
    expect(JSON.parse(init.body as string).model).toBe('llama-3.3-70b-versatile');
    expect(init.headers.authorization).toBe('Bearer gsk-test');
  });

  it('a failing till of words degrades to the local voice — never an error', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    const out = await narrate({ context: pip, newEvents: [], mode: 'peek' }, client);
    expect(out.journal.length).toBeGreaterThan(0); // fallbackNarration, not a throw
    expect(out.mood.length).toBeGreaterThan(0);
  });

  it("carries the provider's own words in the error — a 400 names its reason in the log", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (String(url).endsWith('/models')) return { ok: false, status: 404 };
      return {
        ok: false,
        status: 400,
        text: async () => '{"error":"The model grok-cheap does not exist"}',
      };
    });
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    await expect(
      client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] }),
    ).rejects.toThrow(/400.*grok-cheap does not exist/);
  });

  it('says which model ids it resolved to, and how (onResolve)', async () => {
    const onResolve = vi.fn();
    const live = vi.fn(async (url: string) => {
      if (String(url).endsWith('/models')) {
        return { ok: true, json: async () => ({ data: [{ id: 'grok-5-fast-non-reasoning' }] }) };
      }
      return grokResponse({ journal: 'x', mood: 'calm' });
    });
    const a = makeGrokClient({ ...CFG, onResolve }, live as unknown as typeof fetch);
    await a.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ peek: 'grok-5-fast-non-reasoning', via: 'live-list' }),
    );

    const dead = vi.fn(async (url: string) => {
      if (String(url).endsWith('/models')) return { ok: false, status: 404 };
      return grokResponse({ journal: 'x', mood: 'calm' });
    });
    const onResolve2 = vi.fn();
    const b = makeGrokClient({ ...CFG, onResolve: onResolve2 }, dead as unknown as typeof fetch);
    await b.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    expect(onResolve2).toHaveBeenCalledWith(
      expect.objectContaining({ peek: 'grok-cheap', via: 'configured' }),
    );
  });
});

describe('model auto-resolution — a key alone is enough', () => {
  /** fetch that serves GET /models with the given ids, and chat completions after. */
  function hostWith(ids: string[]) {
    return vi.fn(async (url: string, init?: { body?: string }) => {
      void init;
      if (String(url).endsWith('/models')) {
        return { ok: true, json: async () => ({ data: ids.map((id) => ({ id })) }) };
      }
      return grokResponse({ journal: 'ok', mood: 'calm' });
    });
  }
  const chatBody = (calls: unknown[][]): string =>
    (calls.find(([u]) => String(u).endsWith('/chat/completions'))![1] as { body: string }).body;

  it('keeps the configured id when the host serves it', async () => {
    const fetchFn = hostWith(['grok-cheap', 'grok-finer']);
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    await client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    expect(JSON.parse(chatBody(fetchFn.mock.calls)).model).toBe('grok-cheap');
  });

  it('when the configured id is gone, picks the best live match — narration keeps working', async () => {
    // The host renamed everything; only these exist now.
    const fetchFn = hostWith(['grok-5-image', 'grok-5-fast-non-reasoning', 'grok-5']);
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    await client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    // The xAI preference list lands on the fast non-reasoning tier — never the image model.
    expect(JSON.parse(chatBody(fetchFn.mock.calls)).model).toBe('grok-5-fast-non-reasoning');
  });

  it('resolves once per process, not per call', async () => {
    const fetchFn = hostWith(['grok-cheap', 'grok-finer']);
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    await client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    await client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    const modelCalls = fetchFn.mock.calls.filter(([u]) => String(u).endsWith('/models'));
    expect(modelCalls).toHaveLength(1);
  });

  it('a host without /models just uses the configured ids, as before', async () => {
    const fetchFn = vi.fn(async (url: string, init?: { body?: string }) => {
      void init;
      if (String(url).endsWith('/models')) return { ok: false, status: 404 };
      return grokResponse({ journal: 'ok', mood: 'calm' });
    });
    const client = makeGrokClient(CFG, fetchFn as unknown as typeof fetch);
    await client.messages.create({ model: MODEL_PEEK, max_tokens: 300, messages: [] });
    expect(JSON.parse(chatBody(fetchFn.mock.calls)).model).toBe('grok-cheap');
  });
});
