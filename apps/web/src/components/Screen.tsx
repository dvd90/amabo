/**
 * Screen.tsx — the text content shown on the LCD for the current screen. Button-only
 * navigation means each screen is a tiny, glanceable panel (no mouse menus). Care
 * screens now show the relevant stat + a "what changed" line so an action visibly
 * lands, and any error surfaces instead of failing silently.
 */

import { useState } from 'react';
import type { CreatureViewT } from '@amabo/shared';
import type { StarView } from '../api/client.js';
import { useGame } from '../store/useGame.js';

/** A graduated soul's plaque: name + how long it shone (Mnemosyne). */
function StarDetail({ star }: { star: StarView }) {
  const days = Math.max(1, Math.round((star.graduatedAt - star.bornAt) / 86_400_000));
  return (
    <p className="star-detail">
      ✦ {star.name} — shone {days} day{days === 1 ? '' : 's'}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <span className="stat-bar" aria-hidden="true">
        {'▮'.repeat(Math.round(value / 10)).padEnd(10, '▯')}
      </span>
      <span>{Math.round(value)}</span>
    </div>
  );
}

/** The stat a care action most visibly moves, shown so the change is obvious. */
const CARE_STAT: Record<string, { label: string; pick: (c: CreatureViewT) => number }> = {
  feed: { label: 'ambra', pick: (c) => c.state.stats.ambra },
  clean: { label: 'clean', pick: (c) => c.state.stats.cleanliness },
  play: { label: 'energy', pick: (c) => c.state.stats.energy },
  comfort: { label: 'secur', pick: (c) => c.state.stats.security },
};

const STORY_BEATS: string[] = [
  'Every tenderness that never lands drifts, and pools in the glass as a warm amber light — Ambra.',
  'When enough gathers, it condenses into a Mote: a small life with no shape of its own, made of unspent love.',
  'You are the Light. Look in and tend it and it grows radiant — an Amabo. Neglect it and it sours into a longing Yim. Both can be loved home.',
  'Comfort is the way back from the dark. A soured creature is never lost; the door is never locked.',
  'Loved fully enough, it becomes too bright for the glass and ascends — leaving a named star in your sky you can always find.',
];

export function Screen() {
  const { screen, creature, lastJournal, mood, lastResult, error, journalEntries, stars, busy } =
    useGame();
  const [selectedStar, setSelectedStar] = useState<StarView | null>(null);

  if (!creature) {
    return <p className="screen-text">A Mote is gathering. Press ● to call it into being.</p>;
  }
  const s = creature.state;
  const feedback = error ? (
    <p className="feedback feedback-error">⚠ {error}</p>
  ) : lastResult ? (
    <p className="feedback feedback-ok">✦ {lastResult}</p>
  ) : null;

  switch (screen) {
    case 'home':
      return (
        <div className="screen-text">
          <p>
            {creature.name} — {s.uncanny ? 'Yim' : 'Amabo'}, {s.stage}
            {s.asleep ? ' (asleep)' : ''}
          </p>
          {creature.graduatedAt ? <p>Ascended into Elysium. Look to the Sky.</p> : null}
          {lastJournal ? (
            <p className="journal-line">
              “{lastJournal}” — {mood}
            </p>
          ) : (
            <p>Press ● to look in on {creature.name}.</p>
          )}
          {feedback}
        </div>
      );
    case 'status':
      return (
        <div className="screen-text stats">
          <Stat label="ambra" value={s.stats.ambra} />
          <Stat label="enrgy" value={s.stats.energy} />
          <Stat label="clean" value={s.stats.cleanliness} />
          <Stat label="hlth " value={s.stats.health} />
          <Stat label="affct" value={s.stats.affection} />
          <Stat label="secur" value={s.stats.security} />
          <p>
            disposition {Math.round(s.disposition)}
            {s.ill ? ' · ill' : ''}
          </p>
        </div>
      );
    case 'feed':
    case 'clean':
    case 'play':
    case 'comfort': {
      const stat = CARE_STAT[screen]!;
      return (
        <div className="screen-text">
          <p>
            {screen.toUpperCase()} — press ● {busy ? '…' : 'to give care'}
            {screen === 'comfort' ? '  (the way back from Yim)' : ''}
          </p>
          <Stat label={stat.label} value={stat.pick(creature)} />
          {feedback}
        </div>
      );
    }
    case 'journal':
      return (
        <div className="screen-text journal">
          {lastJournal ? <p className="journal-line">“{lastJournal}”</p> : <p>Press ● to read.</p>}
          {journalEntries.slice(0, 6).map((e, i) => (
            <p key={i} className="journal-entry">
              · {e.text ?? e.tag ?? e.kind}
            </p>
          ))}
          {feedback}
        </div>
      );
    case 'sky':
      return (
        <div className="screen-text sky">
          <p>The constellation of graduated souls:</p>
          {stars.length === 0 ? (
            <p>(none yet — raise an Amabo to its light)</p>
          ) : (
            <span className="sky-stars">
              {stars.map((st) => (
                <button
                  key={st.id}
                  className="star"
                  title={st.name}
                  aria-label={`Star: ${st.name}`}
                  onClick={() => setSelectedStar(st)}
                >
                  ✦
                </button>
              ))}
            </span>
          )}
          {selectedStar ? <StarDetail star={selectedStar} /> : null}
          {feedback}
        </div>
      );
    case 'story':
      return (
        <div className="screen-text story">
          <p className="story-title">The Amarium</p>
          {STORY_BEATS.map((b, i) => (
            <p key={i} className="story-beat">
              {b}
            </p>
          ))}
        </div>
      );
    case 'lights':
      return (
        <div className="screen-text">
          <p>Lights off — {s.asleep ? 'resting' : 'press ● to settle it to sleep'}.</p>
          {feedback}
        </div>
      );
  }
}
