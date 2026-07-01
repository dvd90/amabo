/**
 * DuetScene.tsx — a meeting, *seen* (STORY.md §7¾: a duet, never a duel). When two of
 * your creatures are introduced, they now walk toward each other on a small stage: in
 * harmony a thread of light draws between them and a spark blooms where their Ambra
 * sings; in a wary clash they stop short, a pale moon between them — no one is hurt,
 * they simply haven't found each other yet. Self-gating on the store's `duet`.
 */

import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';

export function DuetScene() {
  const duet = useGame((s) => s.duet);
  const creatures = useGame((s) => s.creatures);
  const dismiss = useGame((s) => s.dismissDuet);
  if (!duet) return null;

  const a = creatures.find((c) => c.id === duet.a) ?? null;
  const b = creatures.find((c) => c.id === duet.b) ?? null;
  const harmony = duet.result === 'harmony';

  return (
    <div
      className={`duet${harmony ? ' is-harmony' : ' is-clash'}`}
      role="dialog"
      aria-label="A meeting"
      onClick={dismiss}
    >
      <div className="duet-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="duet-kicker">{harmony ? 'Resonance' : 'A wary meeting'}</p>
        <div className="duet-stage" aria-hidden="true">
          <span className="duet-thread" />
          <span className="duet-spark">{harmony ? '✦' : '☾'}</span>
          <span className="duet-figure duet-left">
            {a ? <Creature creature={a} /> : <span className="duet-orb" />}
          </span>
          <span className="duet-figure duet-right">
            {b ? <Creature creature={b} /> : <span className="duet-orb" />}
          </span>
        </div>
        <p className="duet-caption">
          {harmony
            ? `${duet.names[0]} and ${duet.names[1]} harmonized — their Ambra sang together.`
            : `${duet.names[0]} and ${duet.names[1]} met, a little wary. Another day, perhaps.`}
        </p>
        <button className="btn btn-b duet-done" onClick={dismiss}>
          {harmony ? 'Leave them to it ✦' : 'Give them time ☾'}
        </button>
      </div>
    </div>
  );
}
