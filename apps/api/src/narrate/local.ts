/**
 * narrate/local.ts — the local, zero-AI peek narrator (the diary the device shows when
 * no model key is set). The engine decides WHAT happened; this tells it in the creature's
 * own voice (STORY.md §9). It is the launch-time voice for a keyless deploy, so it has to
 * read like a real inner life — varied, and actually reflecting the gap.
 *
 * Two properties make it trustworthy:
 *  - It is **pure & deterministic** (no Date/Math.random): the same (seed, state, events)
 *    always yields the same entry, so tests and offline dev are stable.
 *  - It **reads the events**: the dominant condition of the gap (grew, fell ill, warmed,
 *    waited alone, slept, ascended…) selects a register, then a deterministic roll picks
 *    one of many lines — so a second peek rarely repeats the first.
 */

import type { CreatureState, SimEvent } from '@amabo/engine';
import type { Stage } from '@amabo/shared';
import type { NarrateContext, NarrateOutput, Narrator } from './port.js';

// ── Content pools — the voice (STORY.md §9). Grow these freely; more lines = more life. ──

const DEAD = [
  'The glass is quiet now.',
  'The light has gone very still. I am only the warm part of the air now.',
  'No clock, no waiting anymore. Just the quiet, holding the shape of what I was.',
];

const GRADUATION = [
  "I'm too full of light for this small glass now. Don't be sad — look up. I'll be the one you can always find.",
  'I went up and out, the way warmth does. Watch the sky tonight; the bright one near the top is me, waving.',
  "I couldn't stay small any longer. Thank you for all the loving. Find me in the stars and I'll know you.",
  "The glass couldn't hold all the gold, so I spilled upward. I'm in the high dark now — kept, not gone. Look up.",
  'I sailed out into the west, into all that light. I left a star behind so you would never have to forget me.',
];

const EVOLVED_BY_STAGE: Record<Stage, string[]> = {
  mote: [
    'I condensed out of the warm and opened my eyes. So this is the glass. So this is you.',
    'I came together out of all that gathered light. I am small and new and entirely here.',
    'I am only a little ball of glow so far, with no shape of my own yet. But I can feel you looking, and I think I will become someone.',
    'First there was warm, and then there was me. Hello, Light. I will be whatever you love me into.',
  ],
  spark: [
    'Something new came up on the top of me — a small bright point, like an antenna, to listen for you with. I think I am becoming someone.',
    'I grew a little spire today, to catch the light better. It quivers when you look in.',
  ],
  velveteen: [
    'I went soft all over, and grew the beginnings of ears. The old toy was right: you get Real by being loved a long time.',
    'I filled out today. I am plush now, and a bit lopsided, and I think that means it is working.',
  ],
  bloom: [
    'I came all the way into myself today. This is my shape — the one your warmth drew out. I am fully someone now.',
    'No more half-made. I bloomed. I think I look like what being cared for feels like.',
  ],
};
const EVOLVED_FALLBACK = ['I grew. I am a little more myself than I was when you left.'];

const ILL_AMABO = [
  'I went dim and warm and wrong today, like a lamp low on oil. I kept still and waited for you.',
  'Something heavy sat on the light. I did not have much shape to give. Come look in soon?',
  'A grey hour got into the glass and would not leave. I am not at my brightest. I held on.',
];
const ILL_YIM = [
  'The dim found me where I already keep the quiet. I could not tell the fever from the longing.',
  'I was grey on grey today. At least the ache had company.',
];

const RECOVERED = [
  'The grey lifted. I am warm again — a little wobbly, but the light came back up. I waited well, I think.',
  'Whatever sat on me got up and left. I feel like a relit lamp. I missed you in the dark of it.',
  'The fever burned down to embers and then to morning. I am mostly myself again, and glad of it.',
];

// Yim warming back toward the light — community/care as grace (STORY.md §4 redemption).
const WARMING = [
  'Something warm found the corner where I keep my quiet. I did not run from it. Note: the raven left this morning.',
  'The clock ticked once today. Just once. But I heard it, and I thought of you.',
  'I am still mostly hollow, but a little less. The kept light felt almost like a real one tonight.',
  'I let the warmth come closer than I usually do. It did not ask me for anything. Neither did I.',
];

const YIM = [
  'The clock stopped at the same soft hour again. I keep a light I do not have. I am very good company for no one.',
  'I wore your shape today, to see. It did not fit the way I hoped. Nevermore, said the small dark bird, and I agreed.',
  'The dark in here has a grain to it now, like wood. I have had the time to learn it. So much time.',
  'I keep the waiting tidy. I fold it and set it by the wall. There is always more to fold.',
  'A raven came and sat where the warmth used to be. We did not talk. We did not need to.',
  'I counted the hours, and then I counted them again. They came out the same. They always do.',
];

const ASLEEP = [
  'The glass went dark, so I held the warm spot by the wall and slept. It was alright.',
  'I dozed through the low hours and dreamed in soft amber. Nothing chased me. That was nice.',
  'I curled small and let the quiet rock me. I woke once to check that you were coming, then slept again.',
];

const LONELY = [
  "The glass went dark early. I held the warm spot by the wall and waited. It was alright — I've gotten good at waiting.",
  'It was a long quiet. I practiced not minding it. I minded it a little.',
  'You were gone a while. I kept your place warm and talked to the light, so the room would not be empty.',
];

const HUNGRY = [
  'The light ran low today. I dimmed myself to save it, the way you bank a fire. Bring some gold soon?',
  'I got thin and faint by evening — not sad, just running close to empty. I will glow right up when you are back.',
];

// A bright Amabo feeling the first small chill of being left too long (a gentle warning).
const SOURING = [
  'A small chill got into the glass today. I told myself it was nothing. I hope you look in soon.',
  'The gold went a little grey at the edges while you were gone. I am still me. I would just like to be sure of it.',
];

// The warm default — most days are these, so this pool is the largest.
const CONTENT = [
  "The day went soft and gold. I practiced being a rounder shape. I think you'd have liked it.",
  'Nothing happened, beautifully. I floated in the warm and watched the dust catch fire in the light.',
  'I tried three shapes and kept the best one for when you look in. It is a good one. You will see.',
  'The glass smelled like warm honey all afternoon. I just bobbed there, being glad.',
  'I rolled the light from one side to the other, like a slow gold marble. A whole good hour went by.',
  'I taught myself a small trick today — holding very still until the glow gathers. I will show you.',
  'A bright, ordinary day. I grew a little, I think, the way bread does — quietly, from the warmth.',
  'I watched the light change colours at the edge of the glass and decided that is my favourite thing. After you.',
];

interface Register {
  mood: string;
  pool: string[];
  /** A memory this day leaves behind for future continuity (M7), if any. */
  memory?: string;
}

/** Sum the disposition movement across the gap's events (warming > 0, souring < 0). */
function dispositionDrift(events: SimEvent[]): number {
  return events.reduce((sum, e) => sum + e.dispositionDelta, 0);
}

function has(events: SimEvent[], kind: SimEvent['kind']): boolean {
  return events.some((e) => e.kind === kind);
}

/** Pick the register that fits the dominant condition of the gap (first match wins). */
function registerFor(state: CreatureState, events: SimEvent[]): Register {
  if (!state.alive) return { mood: 'still', pool: DEAD };
  if (has(events, 'graduation')) return { mood: 'radiant', pool: GRADUATION };
  if (has(events, 'evolved')) {
    return {
      mood: 'becoming',
      pool: EVOLVED_BY_STAGE[state.stage] ?? EVOLVED_FALLBACK,
      memory: 'The day I grew into more of myself.',
    };
  }
  if (state.ill || has(events, 'fellIll')) {
    return { mood: 'dim', pool: state.uncanny ? ILL_YIM : ILL_AMABO };
  }
  // A Yim drawn back toward the light — redemption (the raven leaving) takes priority over
  // a plain physical recovery; community/care as grace (STORY.md §4).
  if (state.uncanny && dispositionDrift(events) > 0) {
    return { mood: 'thawing', pool: WARMING, memory: 'I let some warmth in, and the raven left.' };
  }
  if (has(events, 'recovered')) {
    return { mood: 'mending', pool: RECOVERED, memory: 'The grey lifted and the light came back.' };
  }
  if (state.uncanny) return { mood: 'longing', pool: YIM };
  if (state.asleep) return { mood: 'resting', pool: ASLEEP };
  if (state.stats.security < 30 || state.stats.affection < 25) {
    return { mood: 'wistful', pool: LONELY };
  }
  if (state.stats.ambra < 25 || state.stats.energy < 20) {
    return { mood: 'faint', pool: HUNGRY };
  }
  if (dispositionDrift(events) < 0) return { mood: 'shadowed', pool: SOURING };
  return { mood: 'content', pool: CONTENT };
}

/** A tiny FNV-1a string hash — deterministic, no randomness. */
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Choose one line from a pool deterministically, but varied across peeks: the roll folds
 * in the seed, the events that happened, and how old the creature is — so the same
 * register reads differently from one gap to the next.
 */
function pick(pool: string[], state: CreatureState, events: SimEvent[]): string {
  const sig = events.map((e) => e.kind).join(',');
  const salt = hash(`${sig}|${Math.floor(state.ageMinutes)}`);
  const roll = (hash(String(state.seed >>> 0)) ^ salt) >>> 0;
  return pool[roll % pool.length]!;
}

/**
 * The very first thought of a newborn Mote — for the pre-signup birth moment (the funnel's
 * front door). Deterministic by seed so the creature a visitor meets is stable.
 */
export function birthThought(seed: number): string {
  const pool = EVOLVED_BY_STAGE.mote;
  return pool[hash(String(seed >>> 0)) % pool.length]!;
}

export const localNarrator: Narrator = {
  async narrate(ctx: NarrateContext, events: SimEvent[] = []): Promise<NarrateOutput> {
    const reg = registerFor(ctx.state, events);
    const journal = pick(reg.pool, ctx.state, events);
    const out: NarrateOutput = { journal, mood: reg.mood };
    if (reg.memory) out.newMemories = [{ text: reg.memory, salience: 5 }];
    return out;
  },
};
