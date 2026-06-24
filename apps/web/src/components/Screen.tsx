/**
 * Screen.tsx — the text content shown on the LCD for the current screen. Button-only
 * navigation means each screen is a tiny, glanceable panel (no mouse menus).
 */

import { useGame } from '../store/useGame.js';

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

export function Screen() {
  const { screen, creature, lastJournal, mood, journalEntries, stars, busy } = useGame();

  if (!creature) {
    return <p className="screen-text">A Mote is gathering. Press ● to call it into being.</p>;
  }
  const s = creature.state;

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
            <p>Press ● to look in.</p>
          )}
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
    case 'comfort':
      return (
        <p className="screen-text">
          {screen.toUpperCase()} — press ● {busy ? '…' : 'to give care'}
          {screen === 'comfort' ? '\n(the way back from Yim)' : ''}
        </p>
      );
    case 'journal':
      return (
        <div className="screen-text journal">
          {lastJournal ? <p className="journal-line">“{lastJournal}”</p> : <p>Press ● to read.</p>}
          {journalEntries.slice(0, 6).map((e, i) => (
            <p key={i} className="journal-entry">
              · {e.text ?? e.tag ?? e.kind}
            </p>
          ))}
        </div>
      );
    case 'sky':
      return (
        <div className="screen-text sky">
          <p>The constellation of graduated souls:</p>
          {stars.length === 0 ? (
            <p>(none yet — raise an Amabo to its light)</p>
          ) : (
            stars.map((st) => (
              <span key={st.id} className="star" title={st.name}>
                ✦
              </span>
            ))
          )}
        </div>
      );
    case 'lights':
      return (
        <p className="screen-text">
          Lights off — {s.asleep ? 'resting' : 'press ● to settle it to sleep'}.
        </p>
      );
  }
}
