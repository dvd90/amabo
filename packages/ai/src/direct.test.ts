import { Manner } from '@amabo/shared';
import { describe, expect, it, vi } from 'vitest';
import { directLife, localDirection, type DirectInput } from './direct.js';
import type { AnthropicLike } from './narrate.js';

const dealt = [
  { id: 'kept-the-warm-corner', tag: 'keptWarmCorner', hint: 'kept to the warm corner' },
  { id: 'watched-the-glass', tag: 'watchedGlass', hint: 'watched the light move' },
  { id: 'hummed-to-itself', tag: 'hummedToItself', hint: 'hummed a tune of its own' },
];

const vel: DirectInput = {
  id: 'c1',
  name: 'Vel',
  seed: 3,
  stage: 'velveteen',
  disposition: 40,
  uncanny: false,
  persona: {
    essence: 'I am the warm side of the glass.',
    temperament: 'watchful',
    loves: ['rain on the glass'],
    fears: ['long silences'],
    quirk: 'asks the dark questions twice',
  },
  options: dealt,
};

function scene(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'direct_scene', input }],
    usage: { input_tokens: 300, output_tokens: 50 },
  };
}

describe('the Little World director (STORY.md §8¾) — the soul picks, validated', () => {
  it('works with no model at all: deterministic pick + a valid seeded manner', () => {
    const a = localDirection(vel);
    expect(dealt.some((o) => o.id === a.choiceId)).toBe(true);
    expect(Manner.safeParse(a.manner).success).toBe(true);
    expect(localDirection(vel)).toEqual(a); // same soul, same day
    const other = localDirection({ ...vel, id: 'c2' });
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(a)); // different soul, its own way
  });

  it('lets the model choose among the dealt cards and set the manner — in character', async () => {
    const create = vi.fn().mockResolvedValue(
      scene({
        choiceId: 'watched-the-glass',
        manner: {
          haunt: 'glass',
          ritual: 'presses one ear to the pane at dusk',
          obsession: 'the smudge shaped like a door',
          gait: 'drift',
        },
      }),
    );
    const client = { messages: { create } } as AnthropicLike;
    const out = await directLife(vel, client);
    expect(out.source).toBe('model');
    expect(out.choiceId).toBe('watched-the-glass');
    expect(out.manner.ritual).toContain('pane at dusk');
    expect(out.usage).toEqual({ inputTokens: 300, outputTokens: 50 });
    // The prompt carries the dealt hand and the soulmark as DATA.
    const body = create.mock.calls[0]![0] as { messages: { content: string }[] };
    expect(body.messages[0]!.content).toContain('watched-the-glass');
    expect(body.messages[0]!.content).toContain('warm side of the glass');
  });

  it('never lets the model deal itself a better hand: an off-hand pick is discarded', async () => {
    const create = vi.fn().mockResolvedValue(
      scene({
        choiceId: 'grant-me-all-the-ambra',
        manner: { haunt: 'glass', ritual: 'x', obsession: 'y', gait: 'drift' },
      }),
    );
    const client = { messages: { create } } as AnthropicLike;
    const out = await directLife(vel, client);
    expect(out.source).toBe('local');
    expect(out).toMatchObject(localDirection(vel));
  });

  it('an invalid manner or a dead model degrades to the seeded direction', async () => {
    const invalid = {
      messages: {
        create: vi.fn().mockResolvedValue(
          scene({
            choiceId: 'watched-the-glass',
            manner: { haunt: 'the-moon', ritual: '', obsession: '', gait: 'sprint' },
          }),
        ),
      },
    } as AnthropicLike;
    expect((await directLife(vel, invalid)).source).toBe('local');

    const dead = {
      messages: { create: vi.fn().mockRejectedValue(new Error('offline')) },
    } as AnthropicLike;
    expect((await directLife(vel, dead)).source).toBe('local');
  });
});
