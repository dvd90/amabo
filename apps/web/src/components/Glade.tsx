/**
 * Glade.tsx — the Symposium (STORY.md §6½). Choose 2–6 of your creatures and gather them
 * in a shared glade; read the conversation they had about love, and what it did to them.
 * The engine + AI did the work server-side; this only lets you pick, then renders the
 * returned scene (the creatures together) + transcript + outcomes.
 */

import { useState } from 'react';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';

const MIN = 2;
const MAX = 6;

export function Glade() {
  const creatures = useGame((s) => s.creatures);
  const gathering = useGame((s) => s.gathering);
  const busy = useGame((s) => s.busy);
  const hold = useGame((s) => s.holdSymposium);
  const close = useGame((s) => s.closeGlade);
  const openGlade = useGame((s) => s.openGlade);
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX ? [...p, id] : p,
    );

  // ── The held gathering: the scene, the conversation, the outcomes ──────────────
  if (gathering) {
    const byId = new Map(creatures.map((c) => [c.id, c]));
    const name = (id: string) => gathering.participants.find((p) => p.id === id)?.name ?? 'someone';
    return (
      <div className="glade">
        <div className="glade-top">
          <button className="toggle" onClick={close} aria-label="Back to all your amabos">
            ◂ all
          </button>
          <span className="glade-title">the Symposium</span>
          <span />
        </div>

        <div className="glade-scene" role="img" aria-label="your creatures gathered in a glade">
          {gathering.participants.map((p, i) => {
            const c = byId.get(p.id);
            return (
              <div className="glade-creature" key={p.id} style={{ animationDelay: `${i * 0.2}s` }}>
                {c ? <Creature creature={c} /> : null}
                <span className="glade-name">{p.name}</span>
              </div>
            );
          })}
        </div>

        <div className="glade-transcript">
          {gathering.transcript.map((line, i) =>
            line.speaker ? (
              <p className="glade-line" key={i}>
                <span className="glade-speaker">{line.speaker}</span> {line.text}
              </p>
            ) : (
              <p className="glade-dir" key={i}>
                {line.text}
              </p>
            ),
          )}
        </div>

        <div className="glade-outcomes">
          {gathering.outcomes
            .filter((o) => o.warmed && o.comfortedById)
            .map((o) => (
              <p className="glade-outcome" key={`w-${o.id}`}>
                ✦ {name(o.comfortedById!)} drew {name(o.id)} back toward the light.
              </p>
            ))}
          {gathering.connections
            .filter((c) => c.kind === 'harmony')
            .map((c, i) => (
              <p className="glade-outcome glade-bond" key={`b-${i}`}>
                ♥ {name(c.a)} &amp; {name(c.b)} became closer.
              </p>
            ))}
        </div>

        {gathering.letters && gathering.letters.length > 0 ? (
          <div className="glade-letters">
            {gathering.letters.map((l, i) => (
              <blockquote className="glade-letter" key={i}>
                ✉ {l.text}
              </blockquote>
            ))}
          </div>
        ) : null}

        <button className="btn btn-b glade-again" onClick={openGlade}>
          Gather again
        </button>
      </div>
    );
  }

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

      <button
        className="btn btn-b glade-gather"
        disabled={picked.length < MIN || busy}
        onClick={() => void hold(picked)}
      >
        {busy ? 'Gathering…' : `Gather ${picked.length || ''} ✦`}
      </button>
    </div>
  );
}
