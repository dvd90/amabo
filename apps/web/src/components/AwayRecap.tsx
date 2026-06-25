/**
 * AwayRecap.tsx — the magic beat (STORY.md §2). When you open a creature after time
 * away, this reveals — before anything else — how long the glass was dark, what changed
 * while you were gone, and the creature's own line about it. The engine decides the
 * facts (`summarizeGap`); the AI supplies the voice; this only tells it tenderly.
 */

import type { GapHighlight } from '../api/client.js';
import { useGame } from '../store/useGame.js';

/** Each factual highlight → a glyph and a sentence fragment (subject is the creature). */
const HIGHLIGHT: Record<GapHighlight, { glyph: string; text: string }> = {
  graduated: { glyph: '✦', text: 'grew too bright for the glass and ascended' },
  grew: { glyph: '✺', text: 'grew into a new shape' },
  brightened: { glyph: '☀', text: 'was loved back toward the light' },
  soured: { glyph: '☾', text: 'dimmed toward longing in the dark' },
  recovered: { glyph: '✚', text: 'mended, and feels well again' },
  fellIll: { glyph: '☓', text: 'fell unwell in the quiet' },
  rested: { glyph: 'z', text: 'rested, and dreamed' },
  content: { glyph: '♥', text: 'kept the warm spot by the wall' },
  hungry: { glyph: '◔', text: 'let its Ambra run low' },
  lonely: { glyph: '◌', text: 'ached a little, alone' },
};

function elapsedLabel(min: number): string {
  if (min < 5) return 'a moment';
  if (min < 60) return `${min} minutes`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/**
 * The recap should feel like returning after a real absence — not pop on every open.
 * So it's gated purely on elapsed time since the last look-in; highlights alone (which
 * exist on almost any state) never trigger it.
 */
const MIN_RECAP_MINUTES = 30;
function meaningful(elapsedMinutes: number): boolean {
  return elapsedMinutes >= MIN_RECAP_MINUTES;
}

export function AwayRecap() {
  const reveal = useGame((s) => s.reveal);
  const journal = useGame((s) => s.lastJournal);
  const mood = useGame((s) => s.mood);
  const creature = useGame((s) => s.creature);
  const dismiss = useGame((s) => s.dismissReveal);

  if (!reveal || !meaningful(reveal.elapsedMinutes)) return null;
  const name = creature?.name ?? 'your Amabo';

  return (
    <div className="recap" role="dialog" aria-label="While you were away">
      <div className="recap-sheet">
        <p className="recap-kicker">While you were away</p>
        <p className="recap-elapsed">{elapsedLabel(reveal.elapsedMinutes)} in the dark</p>

        {reveal.highlights.length > 0 ? (
          <ul className="recap-list">
            {reveal.highlights.map((h) => (
              <li key={h}>
                <span className="recap-glyph" aria-hidden="true">
                  {HIGHLIGHT[h].glyph}
                </span>{' '}
                {name} {HIGHLIGHT[h].text}
              </li>
            ))}
          </ul>
        ) : null}

        {journal ? (
          <p className="recap-journal">
            “{journal}”{mood ? <span className="recap-mood"> — {mood}</span> : null}
          </p>
        ) : null}

        <button className="btn btn-b recap-done" onClick={dismiss}>
          Look in on {name}
        </button>
      </div>
    </div>
  );
}
