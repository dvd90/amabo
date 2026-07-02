/**
 * Introduce.tsx — the introduction, made legible (M-I). The old flow silently turned
 * the roster grid into a selection mode; now introducing two creatures is its own
 * small ceremony: pick a pair from the chips, read their temperaments truthfully
 * (the harmony rule is deterministic — HARMONY_GAP — so we can be honest), and only
 * then let them meet. The reading is also the teaching: a bright friend can draw a
 * souring one back toward the light (STORY.md §7¾ — a duet, never a duel).
 */

import { useState } from 'react';
import { HARMONY_GAP } from '@amabo/shared';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';
import type { RosterItem } from '../api/client.js';

function temper(c: RosterItem): string {
  if (c.state.uncanny) return '☾ longing';
  if (c.state.disposition > 20) return '✦ radiant';
  if (c.state.disposition < 0) return '◌ souring';
  return '· finding its shape';
}

export function Introduce({
  onClose,
  onDone,
}: {
  onClose: () => void;
  /** Receives the after-line (the same note the dashboard shows under the header). */
  onDone: (note: string) => void;
}) {
  const creatures = useGame((s) => s.creatures);
  const meet = useGame((s) => s.meet);
  const busy = useGame((s) => s.busy);
  const [picked, setPicked] = useState<string[]>([]);

  const present = creatures.filter((c) => c.state.alive && !c.graduatedAt && !c.archivedAt);
  const a = present.find((c) => c.id === picked[0]) ?? null;
  const b = present.find((c) => c.id === picked[1]) ?? null;

  const toggle = (id: string) => {
    if (picked.includes(id)) return setPicked(picked.filter((p) => p !== id));
    setPicked(picked.length < 2 ? [...picked, id] : [picked[0]!, id]);
  };

  // The reading: truthful, because the rule is deterministic (gap ≤ HARMONY_GAP).
  let reading: string | null = null;
  let prospect: string | null = null;
  if (a && b) {
    const gap = Math.abs(a.state.disposition - b.state.disposition);
    if (gap <= HARMONY_GAP) {
      reading = 'Their Ambra hums alike — they will harmonize ✦';
      const dim = a.state.disposition <= b.state.disposition ? a : b;
      if (dim.state.disposition < 0) {
        prospect = `${dim.name} may drift back toward the light.`;
      }
    } else {
      reading =
        'Their temperaments are far apart — it may be a wary meeting ☾. Even that leaves a trace of warmth.';
    }
  }

  const letThemMeet = async () => {
    if (!a || !b) return;
    const note = await meet(a.id, b.id);
    onDone(note);
    onClose();
  };

  return (
    <div className="introduce" role="dialog" aria-label="Introduce two creatures" onClick={onClose}>
      <div className="introduce-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="codex-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="intro-kicker">An introduction</p>
        <h2 className="intro-title">Who meets whom?</h2>
        <p className="intro-lede">
          Two of your lights meet for a moment. Kindred temperaments harmonize — and a bright friend
          can draw a souring one back.
        </p>

        <div className="intro-chips">
          {present.map((c) => {
            const isPicked = picked.includes(c.id);
            return (
              <button
                key={c.id}
                className={`intro-chip${isPicked ? ' is-picked' : ''}${c.state.uncanny ? ' is-yim' : ''}`}
                onClick={() => toggle(c.id)}
                aria-pressed={isPicked}
                aria-label={`Choose ${c.name}`}
              >
                <span className="intro-chip-glass">
                  <Creature creature={c} />
                </span>
                <span className="intro-chip-name">{c.name}</span>
                <span className="intro-chip-temper">{temper(c)}</span>
              </button>
            );
          })}
        </div>

        {reading ? (
          <div className={`intro-reading${prospect ? ' has-prospect' : ''}`}>
            <p className="intro-reading-line">{reading}</p>
            {prospect ? <p className="intro-reading-prospect">{prospect}</p> : null}
          </div>
        ) : (
          <p className="intro-hint">
            {picked.length === 0 ? 'Choose the first…' : 'Choose the second…'}
          </p>
        )}

        <button
          className="btn btn-b intro-go"
          onClick={() => void letThemMeet()}
          disabled={!a || !b || busy}
        >
          {busy ? 'They are meeting…' : 'Let them meet ✦'}
        </button>
      </div>
    </div>
  );
}
