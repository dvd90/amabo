import { describe, expect, it, vi } from 'vitest';
import { localChronicle, voiceChronicle, type ChronicleSceneInput } from './chronicle.js';
import type { AnthropicLike } from './narrate.js';

const scene: ChronicleSceneInput = {
  encounters: [
    {
      aName: 'Pip',
      bName: 'Vel',
      valence: 'warm',
      tag: 'sharedWarmth',
      aSoulmark: 'I am the warm side of the glass.',
      bSoulmark: 'I am a promise kept slowly.',
      standing: null,
    },
    {
      aName: 'Vel',
      bName: 'Mo',
      valence: 'strained',
      tag: 'sameWarmCorner',
      aSoulmark: null,
      bSoulmark: null,
      standing: 'They traded the corner by turns, last time.',
    },
  ],
};

function chronicled(entries: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'record_chronicle', input: { entries } }],
    usage: { input_tokens: 500, output_tokens: 120 },
  };
}

describe('the chronicler (STORY.md §8⅞) — writes the book, never the world', () => {
  it('voices every encounter with no model at all — deterministic, valid lengths', () => {
    const out = localChronicle(scene);
    expect(out.entries).toHaveLength(2);
    for (const e of out.entries) {
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.text.length).toBeLessThanOrEqual(300);
      expect(e.standing.length).toBeLessThanOrEqual(140);
    }
    expect(localChronicle(scene)).toEqual(out);
    // The strained line reads as friction, named by the motif — never violence.
    expect(out.entries[1]!.text).toContain('corner');
  });

  it('lets the model write the scenes — validated, clamped, in order', async () => {
    const create = vi.fn().mockResolvedValue(
      chronicled([
        {
          text: 'Pip and Vel sat with their sides touching the same warmth.',
          standing: `Warm as two spoons.${' more'.repeat(40)}`, // overlong → clamped
        },
        {
          text: 'Vel and Mo both wanted the corner; neither said so.',
          standing: 'Careful, lately.',
        },
      ]),
    );
    const client = { messages: { create } } as AnthropicLike;
    const out = await voiceChronicle(scene, client);
    expect(out.source).toBe('model');
    expect(out.entries[0]!.text).toContain('spoons'.length > 0 ? 'warmth' : '');
    expect(out.entries[0]!.standing.length).toBeLessThanOrEqual(140);
    expect(out.usage).toEqual({ inputTokens: 500, outputTokens: 120 });
    // The prompt carries the encounters as DATA.
    const body = create.mock.calls[0]![0] as { messages: { content: string }[] };
    expect(body.messages[0]!.content).toContain('sameWarmCorner');
    expect(body.messages[0]!.content).toContain('promise kept slowly');
  });

  it('a wrong-shaped or dead model degrades to the local book, with a reason', async () => {
    const wrong = {
      messages: { create: vi.fn().mockResolvedValue(chronicled([{ text: '' }])) },
    } as AnthropicLike;
    const out = await voiceChronicle(scene, wrong);
    expect(out.source).toBe('local');
    expect(out.entries).toHaveLength(2);
    expect(out.reason).toBeTruthy();

    const dead = {
      messages: { create: vi.fn().mockRejectedValue(new Error('offline')) },
    } as AnthropicLike;
    expect((await voiceChronicle(scene, dead)).source).toBe('local');
  });
});
