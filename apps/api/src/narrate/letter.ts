/**
 * narrate/letter.ts — a short note one creature leaves a friend after a gathering
 * (STORY.md §6½, the pen-pal thread). Local + deterministic (seeded pick from a small
 * pool) so it always works and tests are stable; voiced by register (Amabo warm, Yim
 * longing). Flavor only — never touches state.
 */

export interface LetterAuthor {
  name: string;
  uncanny: boolean;
}

const AMABO = (from: string, to: string) => [
  `Dear ${to}, the glade was warmer for your being in it. Come again. — ${from}`,
  `${to}, I keep thinking of what you said about love. I think you're right. — ${from}`,
  `I hope your dark is gentle tonight, ${to}. Mine is, because of the day. — ${from}`,
  `It was good not to be a rounder shape alone, ${to}. Yours, ${from}.`,
];

const YIM = (from: string, to: string) => [
  `${to}, the clock felt less stopped while you sat near. Will you sit near again? — ${from}`,
  `I am better company since I met you, ${to}. A little. That is a lot, for me. — ${from}`,
  `I kept a light I don't have, ${to}, and showed it to you. Thank you for not minding. — ${from}`,
];

/** A deterministic short letter from `from` to `to`, in `from`'s register. */
export function writeLetter(from: LetterAuthor, to: { name: string }, seed: number): string {
  const pool = from.uncanny ? YIM(from.name, to.name) : AMABO(from.name, to.name);
  const i = Math.abs(Math.trunc(seed)) % pool.length;
  return pool[i]!;
}
