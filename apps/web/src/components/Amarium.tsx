/**
 * Amarium.tsx — the LCD: a dot-matrix amber world whose glow tracks ambient Ambra
 * (STORY.md §3, ARCHITECTURE.md §10). Scanlines + faint tint; the creature sprite is
 * stage × disposition. Respects prefers-reduced-motion via CSS.
 */

import { useEffect, useRef, useState } from 'react';
import { STAGES, type CreatureViewT } from '@amabo/shared';
import { Creature } from './Creature.js';
import { glow } from './sprite.js';
import { useGame } from '../store/useGame.js';

/**
 * A one-shot flourish when a creature climbs the ladder (STORY.md §6): rays of light
 * burst from the sprite as it becomes more itself. Reaching Bloom — the moment it
 * becomes Real (the Velveteen Rabbit) — gets a softer, lingering shimmer instead.
 */
function EvolveFlourish({ real }: { real: boolean }) {
  return (
    <svg
      className={`amarium-flourish${real ? ' is-real' : ''}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={50}
            y1={50}
            x2={50 + Math.cos(a) * 46}
            y2={50 + Math.sin(a) * 46}
            stroke="hsl(38 95% 70%)"
            strokeWidth={real ? 1.4 : 2.2}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={50} cy={50} r={20} fill="none" stroke="hsl(38 95% 76%)" strokeWidth={2} />
    </svg>
  );
}

/**
 * Watches the live creature and, while the screen stays open, fires a flourish the
 * instant its stage climbs (e.g. a peek's catch-up tips it into the next stage).
 * Returns a kind ('evolve' | 'real') for ~1.6s, then null. Keyed per-creature so
 * switching sprites never mis-fires.
 */
function useStageClimb(creature: CreatureViewT | null): 'evolve' | 'real' | null {
  const prev = useRef<{ id: string; idx: number } | null>(null);
  const [kind, setKind] = useState<'evolve' | 'real' | null>(null);
  const id = creature?.id ?? null;
  const idx = creature ? STAGES.indexOf(creature.state.stage) : -1;
  useEffect(() => {
    const p = prev.current;
    prev.current = id ? { id, idx } : null;
    if (!p || p.id !== id || idx <= p.idx) return;
    setKind(STAGES[idx] === 'bloom' ? 'real' : 'evolve');
    const t = setTimeout(() => setKind(null), 1600);
    return () => clearTimeout(t);
  }, [id, idx]);
  return kind;
}

/**
 * The world around the creature reacts to its disposition (STORY.md §4, §11): a radiant
 * Amabo drifts in warm Ambra motes; a Yim's glass is Satis House in miniature — a
 * stopped clock, a guttering candle, a perched raven. Purely decorative, behind the sprite.
 */
function Environment({ uncanny }: { uncanny: boolean }) {
  if (uncanny) {
    return (
      <div className="amarium-env amarium-yim" aria-hidden="true">
        <svg className="yim-clock" viewBox="0 0 24 24" width="22" height="22">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.4" />
          {/* hands stopped at a soft, late hour */}
          <line x1="12" y1="12" x2="12" y2="6.5" stroke="currentColor" strokeWidth="1.4" />
          <line x1="12" y1="12" x2="15.5" y2="13.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <svg className="yim-candle" viewBox="0 0 12 24" width="10" height="20">
          <rect x="4.2" y="9" width="3.6" height="13" fill="currentColor" opacity="0.7" />
          <ellipse className="yim-flame" cx="6" cy="6.5" rx="1.6" ry="3" fill="hsl(38 90% 70%)" />
        </svg>
        <svg className="yim-raven" viewBox="0 0 24 16" width="26" height="17">
          <path
            d="M1 14 Q6 10 11 12 Q9 6 14 5 Q12 9 16 10 Q21 9 23 4 Q22 12 14 14 Q7 15 1 14 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className="amarium-env amarium-amabo" aria-hidden="true">
      {[12, 30, 50, 68, 86].map((left, i) => (
        <span
          key={i}
          className="amabo-mote"
          style={{ left: `${left}%`, animationDelay: `${i * 1.3}s` }}
        />
      ))}
    </div>
  );
}

export function Amarium({ creature }: { creature: CreatureViewT | null }) {
  const emote = useGame((s) => s.emote);
  const emoteNonce = useGame((s) => s.emoteNonce);
  const intensity = creature ? glow(creature) : 0.05;
  const climb = useStageClimb(creature);

  // Pygmalion's gaze: the creature's eyes drift toward wherever the Light is touching
  // the glass. We translate the cursor/touch into a -1..1 offset on each axis and feed
  // it to the sprite as CSS vars; CSS does the easing so React doesn't re-render.
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    e.currentTarget.style.setProperty('--look-x', x.toFixed(3));
    e.currentTarget.style.setProperty('--look-y', y.toFixed(3));
  };
  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--look-x', '0');
    e.currentTarget.style.setProperty('--look-y', '0');
  };

  // Tap the creature and it giggles — a quick happy wiggle (a living thing reacts to
  // being poked). Re-armed via a nonce so rapid taps each replay the animation.
  const [giggle, setGiggle] = useState(0);
  const poke = () => {
    if (creature?.state.alive && !creature.state.asleep) setGiggle((n) => n + 1);
  };

  return (
    <div
      className="amarium"
      role="img"
      aria-label={
        creature
          ? `${creature.name}, a ${creature.state.uncanny ? 'Yim' : 'Amabo'} at the ${creature.state.stage} stage`
          : 'an empty, dark Amarium'
      }
      onPointerMove={track}
      onPointerLeave={release}
      style={{ ['--ambra' as string]: intensity.toFixed(3) }}
    >
      <div className="amarium-glow" />
      {creature && creature.state.alive ? <Environment uncanny={creature.state.uncanny} /> : null}
      <div className="amarium-sprite" onClick={poke}>
        {creature ? (
          <span className={giggle ? 'is-giggling' : undefined} key={giggle}>
            <Creature creature={creature} emote={emote} emoteNonce={emoteNonce} />
          </span>
        ) : (
          <span className="amarium-empty">·</span>
        )}
      </div>
      {climb ? <EvolveFlourish real={climb === 'real'} /> : null}
      <div className="amarium-scanlines" aria-hidden="true" />
    </div>
  );
}
