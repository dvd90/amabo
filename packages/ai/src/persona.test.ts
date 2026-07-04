import { Persona } from '@amabo/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AnthropicLike } from './narrate.js';
import { generatePersona, localPersona } from './persona.js';

describe('the Soulmark (STORY.md §8½) — no two Motes alike', () => {
  it('condenses a valid, deterministic soulmark with no model at all', () => {
    const a = localPersona({ id: 'creature-a', name: 'Pip', seed: 7 });
    expect(Persona.safeParse(a).success).toBe(true);
    expect(a.essence).toContain('I am');
    // Deterministic: the same creature always carries the same mark…
    expect(localPersona({ id: 'creature-a', name: 'Pip', seed: 7 })).toEqual(a);
    // …and different creatures carry different ones, even with the same seed.
    const b = localPersona({ id: 'creature-b', name: 'Pip', seed: 7 });
    expect(b).not.toEqual(a);
  });

  it('spreads wide: fifty creatures, fifty distinct soulmarks', () => {
    const marks = new Set(
      Array.from({ length: 50 }, (_, i) =>
        JSON.stringify(localPersona({ id: `c${i}`, name: `M${i}`, seed: i })),
      ),
    );
    expect(marks.size).toBe(50);
  });

  it('lets the model elaborate the mark — validated, never trusted', async () => {
    const client: AnthropicLike = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'condense_soul',
              input: {
                essence: 'I am the small warm thing that waits by doors.',
                temperament: 'watchful',
                loves: ['rain on the glass'],
                fears: ['long silences'],
                quirk: 'asks the dark questions twice',
              },
            },
          ],
          usage: { input_tokens: 400, output_tokens: 80 },
        }),
      },
    };
    const out = await generatePersona({ id: 'c1', name: 'Vel', seed: 3 }, client);
    expect(out.persona.essence).toContain('waits by doors');
    expect(out.source).toBe('model');
    expect(out.usage).toEqual({ inputTokens: 400, outputTokens: 80 });
    // The prompt carries the seeded sketch as inspiration and the name as data.
    const body = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: { content: string }[];
    };
    expect(body.messages[0]!.content).toContain('Vel');
  });

  it('forgives a sloppy model: overlong fields are clamped to the mark, not discarded', async () => {
    const client: AnthropicLike = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'condense_soul',
              input: {
                essence: `I am ${'a very long thing '.repeat(20)}`, // > 160 chars
                temperament: 'Quietly Watchful And Then Some', // >24, multi-word, capitalised
                loves: ['rain', 'dust', 'doors', 'echoes', 'names'], // 5 > max 3
                fears: ['  the dark between blinks  '], // needs trimming
                quirk: 'x'.repeat(300), // > 120
              },
            },
          ],
        }),
      },
    };
    const out = await generatePersona({ id: 'c1', name: 'Vel', seed: 3 }, client);
    expect(out.source).toBe('model'); // clamped, kept — not thrown away
    expect(Persona.safeParse(out.persona).success).toBe(true);
    expect(out.persona.essence.length).toBeLessThanOrEqual(160);
    expect(out.persona.temperament.length).toBeLessThanOrEqual(24);
    expect(out.persona.loves).toHaveLength(3);
    expect(out.persona.quirk.length).toBeLessThanOrEqual(120);
  });

  it('says WHY when the mark could not be taken from the model', async () => {
    const dead: AnthropicLike = {
      messages: { create: vi.fn().mockRejectedValue(new Error('429 rate limited')) },
    };
    const out = await generatePersona({ id: 'c1', name: 'Vel', seed: 3 }, dead);
    expect(out.source).toBe('local');
    expect(out.reason).toContain('429');

    const mute: AnthropicLike = {
      messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
    };
    const out2 = await generatePersona({ id: 'c1', name: 'Vel', seed: 3 }, mute);
    expect(out2.source).toBe('local');
    expect(out2.reason).toBeTruthy();
  });

  it('a mute or malformed model still leaves a soul: the seeded mark stands in', async () => {
    const broken: AnthropicLike = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'tool_use', name: 'condense_soul', input: { essence: '' } }],
        }),
      },
    };
    const out = await generatePersona({ id: 'c1', name: 'Vel', seed: 3 }, broken);
    expect(out.source).toBe('local');
    expect(Persona.safeParse(out.persona).success).toBe(true);
    expect(out.persona).toEqual(localPersona({ id: 'c1', name: 'Vel', seed: 3 }));

    const dead: AnthropicLike = {
      messages: { create: vi.fn().mockRejectedValue(new Error('offline')) },
    };
    const out2 = await generatePersona({ id: 'c1', name: 'Vel', seed: 3 }, dead);
    expect(out2.source).toBe('local');
  });
});
