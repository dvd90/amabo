/**
 * SymposiumScene.tsx — the gathering, played as a scene (STORY.md §6½). The creatures
 * stand in a crescent around a lantern and the conversation unfolds beat by beat: the
 * speaker lights up with a bubble over its head while the others listen, then the
 * resonance shows (sparks between friends, a Yim warmed toward the light), then a toast.
 * Auto-advances; tap to hurry, Skip to jump to the summary. Built from the pure script.
 */

import { useEffect, useMemo, useState } from 'react';
import { Creature } from './Creature.js';
import { useGame } from '../store/useGame.js';
import { buildScript, beatDuration, type Beat } from '../symposium-script.js';
import type { GatheringView } from '../api/client.js';

/** Crescent layout around the lantern: middle figures sit further (higher, smaller). */
function place(i: number, n: number) {
  const t = n === 1 ? 0.5 : i / (n - 1);
  const depth = Math.sin(t * Math.PI); // 0 at the ends, 1 in the middle
  return { left: 14 + t * 72, top: 64 - depth * 15, scale: 1 - depth * 0.16 };
}

/** Keep a speech bubble inside the stage by anchoring it left/right near the edges. */
function bubbleAlign(left: number): string {
  if (left < 34) return ' is-left';
  if (left > 66) return ' is-right';
  return '';
}

function captionFor(beat: Beat, name: (id: string) => string): string | null {
  switch (beat.kind) {
    case 'dir':
      return beat.text;
    case 'spark':
      return `✦ ${name(beat.a)} and ${name(beat.b)} found their light agreed.`;
    case 'warm':
      return `${name(beat.by)} drew ${name(beat.who)} back toward the light.`;
    case 'toast':
      return 'A toast — to love that found somewhere to land.';
    default:
      return null;
  }
}

export function SymposiumScene({ gathering }: { gathering: GatheringView }) {
  const creatures = useGame((s) => s.creatures);
  const openGlade = useGame((s) => s.openGlade);
  const close = useGame((s) => s.closeGlade);
  const byId = useMemo(() => new Map(creatures.map((c) => [c.id, c])), [creatures]);
  const name = (id: string) => gathering.participants.find((p) => p.id === id)?.name ?? 'someone';

  const beats = useMemo(() => buildScript(gathering), [gathering]);
  const [idx, setIdx] = useState(0);
  const done = idx >= beats.length;
  const beat = done ? null : beats[idx]!;

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setIdx((i) => i + 1), beatDuration(beat!));
    return () => window.clearTimeout(t);
  }, [idx, done, beat]);

  const speakingId = beat?.kind === 'say' ? beat.speakerId : null;
  const warming = beat?.kind === 'warm' ? beat : null;
  const caption = beat && beat.kind !== 'say' ? captionFor(beat, name) : null;

  // ── The summary (after the scene plays, or on Skip) ────────────────────────────
  if (done) {
    return (
      <div className="glade">
        <div className="glade-top">
          <button className="toggle" onClick={close} aria-label="Back to all your amabos">
            ◂ all
          </button>
          <span className="glade-title">the Symposium</span>
          <span />
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

  // ── The scene, playing ─────────────────────────────────────────────────────────
  return (
    <div className="glade">
      <div className="glade-top">
        <button className="toggle" onClick={close} aria-label="Back to all your amabos">
          ◂ all
        </button>
        <span className="glade-title">the Symposium</span>
        <button className="linkish sym-skip" onClick={() => setIdx(beats.length)}>
          Skip ⤓
        </button>
      </div>

      <div
        className="sym-stage"
        onClick={() => setIdx((i) => Math.min(beats.length, i + 1))}
        role="img"
        aria-label="your creatures gathered around a lantern"
      >
        <div className="sym-lantern" aria-hidden="true">
          <span className="sym-flame" />
        </div>

        {gathering.participants.map((p, i) => {
          const c = byId.get(p.id);
          const pos = place(i, gathering.participants.length);
          const cls = [
            'sym-figure',
            speakingId === p.id ? 'is-speaking' : '',
            speakingId && speakingId !== p.id ? 'is-listening' : '',
            warming?.who === p.id ? 'is-warming' : '',
            warming?.by === p.id ? 'is-comforter' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={p.id}
              className={cls}
              style={{ left: `${pos.left}%`, top: `${pos.top}%`, ['--s' as string]: pos.scale }}
            >
              {beat?.kind === 'say' && beat.speakerId === p.id ? (
                <span className={`sym-bubble${bubbleAlign(pos.left)}`}>{beat.text}</span>
              ) : null}
              <span className="sym-art">{c ? <Creature creature={c} /> : null}</span>
              <span className="sym-name">{p.name}</span>
            </div>
          );
        })}
      </div>

      {caption ? <p className="sym-caption">{caption}</p> : null}

      <div className="sym-progress" aria-hidden="true">
        {beats.map((_, i) => (
          <span key={i} className={`sym-dot${i <= idx ? ' is-on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
