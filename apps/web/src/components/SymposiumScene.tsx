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
import { setMusicMood } from '../audio.js';
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
  const layout = useMemo(
    () =>
      gathering.participants.map((p, i) => ({
        id: p.id,
        ...place(i, gathering.participants.length),
      })),
    [gathering],
  );
  const at = (id: string) => layout.find((l) => l.id === id);
  const [idx, setIdx] = useState(0);
  const done = idx >= beats.length;
  const beat = done ? null : beats[idx]!;

  // A warmer theme plays while the gathering does (the Light already gestured to gather).
  useEffect(() => {
    setMusicMood('amabo');
  }, []);

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setIdx((i) => i + 1), beatDuration(beat!));
    return () => window.clearTimeout(t);
  }, [idx, done, beat]);

  const speakingId = beat?.kind === 'say' ? beat.speakerId : null;
  const warming = beat?.kind === 'warm' ? beat : null;
  const spark = beat?.kind === 'spark' ? beat : null;
  const toasting = beat?.kind === 'toast';
  const caption = beat && beat.kind !== 'say' ? captionFor(beat, name) : null;

  // Tap a creature to let it speak its mind: a transient echo of one of its lines.
  const linesBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const b of beats) {
      if (b.kind === 'say' && b.speakerId) {
        const arr = m.get(b.speakerId) ?? [];
        arr.push(b.text);
        m.set(b.speakerId, arr);
      }
    }
    return m;
  }, [beats]);
  const [echo, setEcho] = useState<{ id: string; text: string } | null>(null);
  const speak = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // don't also advance the scene
    const ls = linesBy.get(id);
    if (!ls || ls.length === 0) return;
    const text = ls[Math.floor(Math.random() * ls.length)]!;
    setEcho({ id, text });
    window.setTimeout(() => setEcho((cur) => (cur?.id === id ? null : cur)), 2600);
  };
  const toastIdx = beats.findIndex((b) => b.kind === 'toast');

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

        {gathering.connections.some((c) => c.kind === 'harmony') ? (
          <div className="glade-constellation">
            <svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              {gathering.connections
                .filter((c) => c.kind === 'harmony')
                .map((c, i) => {
                  const a = at(c.a);
                  const b = at(c.b);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={i}
                      x1={a.left}
                      y1={a.top * 0.6}
                      x2={b.left}
                      y2={b.top * 0.6}
                      className="constellation-thread"
                    />
                  );
                })}
              {layout.map((l) => (
                <circle
                  key={l.id}
                  cx={l.left}
                  cy={l.top * 0.6}
                  r={2.4}
                  className="constellation-star"
                />
              ))}
            </svg>
            <p className="glade-constellation-cap">the friendships that formed</p>
          </div>
        ) : null}

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
        <span className="sym-controls">
          {toastIdx >= 0 && idx < toastIdx ? (
            <button className="linkish" onClick={() => setIdx(toastIdx)} title="Raise a toast">
              🥂 Toast
            </button>
          ) : null}
          <button className="linkish" onClick={() => setIdx(beats.length)}>
            Skip ⤓
          </button>
        </span>
      </div>

      <div
        className={`sym-stage${toasting ? ' is-toasting' : ''}`}
        onClick={() => setIdx((i) => Math.min(beats.length, i + 1))}
        role="img"
        aria-label="your creatures gathered around a lantern"
      >
        <div className="sym-lantern" aria-hidden="true">
          <span className="sym-flame" />
        </div>

        {/* the rounds of the Symposium: each creature's turn to speak is announced */}
        {beat?.kind === 'say' && beat.roundStart ? (
          <div className="sym-round" key={`r-${idx}`}>
            ✦ {beat.speaker} speaks ✦
          </div>
        ) : null}

        {/* resonance you can see: a thread of light between two who connect */}
        {spark || warming ? (
          <svg
            className="sym-fx"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {(() => {
              const pair = spark ? [at(spark.a), at(spark.b)] : [at(warming!.by), at(warming!.who)];
              const [p1, p2] = pair;
              if (!p1 || !p2) return null;
              const mx = (p1.left + p2.left) / 2;
              const my = (p1.top + p2.top) / 2;
              return (
                <>
                  <line
                    className="sym-thread"
                    x1={p1.left}
                    y1={p1.top}
                    x2={p2.left}
                    y2={p2.top}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text className={spark ? 'sym-heart' : 'sym-heart is-warm'} x={mx} y={my}>
                    {spark ? '♥' : '✦'}
                  </text>
                </>
              );
            })()}
          </svg>
        ) : null}

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
          const bubbleText =
            beat?.kind === 'say' && beat.speakerId === p.id
              ? beat.text
              : echo?.id === p.id
                ? echo.text
                : null;
          return (
            <div
              key={p.id}
              className={cls}
              style={{ left: `${pos.left}%`, top: `${pos.top}%`, ['--s' as string]: pos.scale }}
              onClick={(e) => speak(p.id, e)}
              title={`Let ${p.name} speak`}
            >
              {bubbleText ? (
                <span className={`sym-bubble${bubbleAlign(pos.left)}`}>{bubbleText}</span>
              ) : null}
              <span className="sym-art">
                {c ? (
                  <Creature creature={c} />
                ) : (
                  // A guest from another world appears as a glimmer (we don't hold its full art).
                  <span
                    className={`sym-guest-orb${p.uncanny ? ' is-yim' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="sym-name">
                {p.name}
                {p.guest ? (
                  <span className="sym-guest" title="a friend’s creature, visiting">
                    {' '}
                    ✦
                  </span>
                ) : null}
              </span>
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
