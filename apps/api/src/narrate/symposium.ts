/**
 * narrate/symposium.ts — the narration boundary for a gathering (STORY.md §6½). The
 * engine decides WHAT happened (the outline); this turns it into the creatures' own
 * voice — a short conversation about love. A local, templated narrator ships here so the
 * Symposium works with zero AI; M-S3 adds an AI-backed narrator behind the same port.
 * It never mutates state.
 */

import type { GatherResult } from '@amabo/engine';
import type { TranscriptLine } from '../repo/types.js';

export interface SymposiumParticipant {
  id: string;
  name: string;
  uncanny: boolean;
  stage: string;
  disposition: number;
}

export interface SymposiumContext {
  participants: SymposiumParticipant[];
  outline: GatherResult;
  /** What the Light asked them to speak of (a short theme), if any. */
  topic?: string;
}

export interface SymposiumNarrator {
  narrate(ctx: SymposiumContext): Promise<TranscriptLine[]>;
}

const dir = (text: string): TranscriptLine => ({ speaker: '', text });
const said = (speaker: string, text: string): TranscriptLine => ({ speaker, text });

/**
 * A small, safe, voice-appropriate transcript built without any model call. Deterministic
 * (derived purely from the outline), so tests and offline dev still read warmly.
 */
export const localSymposiumNarrator: SymposiumNarrator = {
  async narrate({ participants, outline, topic }) {
    const name = (id: string) => participants.find((p) => p.id === id)?.name ?? 'someone';
    const opening = topic
      ? `The glade filled with a soft, gathering light. They had come to speak of ${topic}.`
      : 'The glade filled with a soft, gathering light.';
    const lines: TranscriptLine[] = [dir(opening)];

    // An elder takes up the old question first (the Skin Horse), if one sat with a Mote.
    const mentor = outline.moments.find((m) => m.tag === 'mentor');
    if (mentor) {
      lines.push(
        said(
          name(mentor.participants[0]),
          'You become Real, little one — not all at once, but by being loved a long time.',
        ),
      );
      lines.push(said(name(mentor.participants[1]), 'Does it hurt?'));
      lines.push(said(name(mentor.participants[0]), 'Only the way warmth does.'));
    }

    // The harmonisers find their easy quiet, and someone names what they feel.
    const harmony = outline.connections.find((c) => c.kind === 'harmony');
    if (harmony) {
      lines.push(
        said(name(harmony.a), 'Love is only attention that finally found somewhere to land.'),
      );
      lines.push(said(name(harmony.b), 'Then we are all a little less unspent tonight.'));
    }

    // A Yim drawn back toward the light by a companion — community as grace.
    for (const o of outline.outcomes) {
      if (o.warmed && o.comfortedById) {
        lines.push(
          said(name(o.comfortedById), `Stay a while. The dark is easier shared, ${name(o.id)}.`),
        );
        lines.push(said(name(o.id), 'The clock feels less stopped, with you here.'));
      }
    }

    // Small joys.
    const share = outline.moments.find((m) => m.tag === 'shareAmbra');
    if (share)
      lines.push(
        dir(
          `${name(share.participants[0])} passed a little warmth to ${name(share.participants[1])}, hand to hand.`,
        ),
      );
    const play = outline.moments.find((m) => m.tag === 'play');
    if (play)
      lines.push(
        dir(
          `${name(play.participants[0])} and ${name(play.participants[1])} chased the light around the glade.`,
        ),
      );

    lines.push(dir('They sat together until the light went low. No one was alone in the dark.'));
    return lines;
  },
};
