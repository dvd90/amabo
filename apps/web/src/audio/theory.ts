/**
 * audio/theory.ts — PURE music helpers for the generative soundtrack. Kept free of Web
 * Audio so it's unit-testable. The whole point: notes are always drawn from a pentatonic
 * scale, so the music is consonant by construction — never "crazy." Mood shifts the
 * scale: a radiant Amabo hears warm major; a soured Yim hears a sparser minor.
 */

export type Mood = 'amabo' | 'yim';

const SEMITONE = 2 ** (1 / 12);

/** Frequency of a note `semitones` above a root frequency (equal temperament). */
export function hz(rootHz: number, semitones: number): number {
  return rootHz * SEMITONE ** semitones;
}

/** Pentatonic scale degrees (semitone offsets) per mood. */
export const SCALE_STEPS: Record<Mood, number[]> = {
  amabo: [0, 2, 4, 7, 9], // major pentatonic — warm, open
  yim: [0, 3, 5, 7, 10], // minor pentatonic — wistful, hollow
};

/** Root pitch per mood (A3 for Amabo, a gloomier G3 for Yim). */
export const ROOT_HZ: Record<Mood, number> = { amabo: 220, yim: 196 };

/** Is a semitone offset (any octave) a member of the mood's scale? */
export function inScale(mood: Mood, semitone: number): boolean {
  const m = ((semitone % 12) + 12) % 12;
  return SCALE_STEPS[mood].includes(m);
}

/** The allowed note frequencies for a mood across `octaves`. */
export function scaleFreqs(mood: Mood, octaves = 3): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) {
    for (const step of SCALE_STEPS[mood]) out.push(hz(ROOT_HZ[mood], step + 12 * o));
  }
  return out;
}

/** Pick a scale frequency from a roll in [0, 1). Always lands on an in-scale note. */
export function pickFreq(mood: Mood, r01: number, octaves = 3): number {
  const freqs = scaleFreqs(mood, octaves);
  const i = Math.max(0, Math.min(freqs.length - 1, Math.floor(r01 * freqs.length)));
  return freqs[i]!;
}

/** Bass note: the mood's root, an octave down. */
export function bassHz(mood: Mood): number {
  return ROOT_HZ[mood] / 2;
}
