/**
 * Glade.tsx — the Symposium (STORY.md §6½). Choose 2–6 of your creatures and gather them
 * in a shared glade; read the conversation they had about love, and what it did to them.
 * The engine + AI did the work server-side; this only lets you pick, then renders the
 * returned scene (the creatures together) + transcript + outcomes.
 */

import { useState } from 'react';
import { Creature } from './Creature.js';
import { SymposiumScene } from './SymposiumScene.js';
import { useGame } from '../store/useGame.js';

const MIN = 2;
const MAX = 6;
const TOPICS = ['love', 'the dark', 'becoming Real', 'home', 'the Light'] as const;

export function Glade() {
  const creatures = useGame((s) => s.creatures);
  const gathering = useGame((s) => s.gathering);
  const busy = useGame((s) => s.busy);
  const hold = useGame((s) => s.holdSymposium);
  const close = useGame((s) => s.closeGlade);
  const [picked, setPicked] = useState<string[]>([]);
  const [topic, setTopic] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX ? [...p, id] : p,
    );

  // A held gathering plays as an animated scene (which also renders the summary at the end).
  if (gathering) return <SymposiumScene gathering={gathering} />;

  // ── Choosing who gathers ───────────────────────────────────────────────────────
  return (
    <div className="glade">
      <div className="glade-top">
        <button className="toggle" onClick={close} aria-label="Back to all your amabos">
          ◂ all
        </button>
        <span className="glade-title">the Symposium</span>
        <span />
      </div>
      <p className="glade-lede">
        Gather {MIN}–{MAX} of your creatures in the glade to be together and speak of love.
      </p>

      <div className="glade-roster">
        {creatures.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              className={`glade-pick${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(c.id)}
            >
              <span className="glade-pick-art">
                <Creature creature={c} />
              </span>
              <span className="glade-pick-name">{c.name}</span>
            </button>
          );
        })}
      </div>

      <p className="glade-topic-lede">Speak of…</p>
      <div className="glade-topics">
        {TOPICS.map((t) => (
          <button
            key={t}
            className={`glade-topic${topic === t ? ' is-on' : ''}`}
            aria-pressed={topic === t}
            onClick={() => setTopic((cur) => (cur === t ? null : t))}
          >
            {t}
          </button>
        ))}
      </div>

      <button
        className="btn btn-b glade-gather"
        disabled={picked.length < MIN || busy}
        onClick={() => void hold(picked, topic ?? undefined)}
      >
        {busy ? 'Gathering…' : `Gather ${picked.length || ''} ✦`}
      </button>
    </div>
  );
}
