/**
 * symposium-script.ts — turn a held gathering (the transcript + engine outline the server
 * returns) into an ordered list of BEATS the Glade plays one at a time (STORY.md §6½). The
 * server decides *what* happened and *what was said*; this is pure presentation — a
 * deterministic script the scene animates: the conversation, then the resonance you can
 * see (sparks between harmonisers, a Yim warmed by a companion), then a closing toast.
 */

import type { GatheringView } from './api/client.js';

export type Beat =
  | { kind: 'dir'; text: string }
  | { kind: 'say'; speakerId: string | null; speaker: string; text: string }
  | { kind: 'spark'; a: string; b: string }
  | { kind: 'warm'; who: string; by: string }
  | { kind: 'toast' };

export function buildScript(g: GatheringView): Beat[] {
  const idByName = new Map(g.participants.map((p) => [p.name, p.id]));
  const beats: Beat[] = [];

  // The conversation, in order (a stage direction has an empty speaker).
  for (const line of g.transcript) {
    if (line.speaker) {
      beats.push({
        kind: 'say',
        speakerId: idByName.get(line.speaker) ?? null,
        speaker: line.speaker,
        text: line.text,
      });
    } else {
      beats.push({ kind: 'dir', text: line.text });
    }
  }

  // Then the resonance, made visible: a spark between each harmonising pair…
  for (const c of g.connections) {
    if (c.kind === 'harmony') beats.push({ kind: 'spark', a: c.a, b: c.b });
  }
  // …and a Yim drawn back toward the light by its brightest companion.
  for (const o of g.outcomes) {
    if (o.warmed && o.comfortedById) beats.push({ kind: 'warm', who: o.id, by: o.comfortedById });
  }

  beats.push({ kind: 'toast' });
  return beats;
}

/** How long (ms) a beat lingers before the scene auto-advances. */
export function beatDuration(beat: Beat): number {
  switch (beat.kind) {
    case 'say':
      return Math.min(5200, Math.max(2000, beat.text.length * 48));
    case 'dir':
      return 2600;
    case 'toast':
      return 2600;
    default:
      return 1500;
  }
}
