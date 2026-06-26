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
import { nightMood } from '../worldtime.js';
import { buildScene, type PropKind } from '../scenery.js';

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

/**
 * Atmosphere — depth in the glass (purely decorative): floating dust at varied size,
 * speed and drift so near specks read as closer than far ones (parallax). Sits behind
 * and around the sprite; deterministic, no randomness.
 */
const DUST = [
  { left: 14, top: 70, s: 2.4, d: 0, dur: 13 },
  { left: 32, top: 40, s: 1.4, d: 2.5, dur: 18 },
  { left: 48, top: 82, s: 3.1, d: 1, dur: 11 },
  { left: 63, top: 52, s: 1.7, d: 4, dur: 16 },
  { left: 78, top: 30, s: 2.2, d: 3, dur: 14 },
  { left: 88, top: 66, s: 1.3, d: 6, dur: 19 },
  { left: 24, top: 22, s: 1.9, d: 5, dur: 15 },
  { left: 56, top: 16, s: 1.2, d: 1.5, dur: 20 },
];

type PropPalette = {
  col: string;
  dark: string;
  leaf: string;
  lit: string;
  voidc: string;
  hue: number;
  sat: number;
};

/** A single scene prop, drawn as a detailed silhouette anchored at its base (0,0). */
function propShape(kind: PropKind, p: PropPalette) {
  const { col, dark, leaf, lit, voidc, hue } = p;
  switch (kind) {
    case 'leafy':
      return (
        <>
          <rect x={-1.1} y={-7} width={2.2} height={7} fill={dark} />
          <line x1={0} y1={-5} x2={-2.6} y2={-8} stroke={dark} strokeWidth={1} />
          <line x1={0} y1={-6} x2={2.4} y2={-9} stroke={dark} strokeWidth={1} />
          <circle cx={0} cy={-12} r={5.4} fill={col} />
          <circle cx={-4} cy={-9} r={4} fill={col} />
          <circle cx={4} cy={-9.5} r={3.8} fill={col} />
          <circle cx={0} cy={-8} r={4} fill={col} />
          <circle cx={-2} cy={-13.5} r={3} fill={leaf} />
          <circle cx={2.6} cy={-12} r={2.4} fill={leaf} />
        </>
      );
    case 'pine':
      return (
        <>
          <rect x={-1} y={-4} width={2} height={4} fill={dark} />
          <polygon points="0,-21 -6,-10 6,-10" fill={col} />
          <polygon points="0,-15 -5.4,-6 5.4,-6" fill={col} />
          <polygon points="0,-10 -4.4,-3 4.4,-3" fill={col} />
          <polygon points="0,-21 -2.6,-15.5 0,-15.5" fill={leaf} />
        </>
      );
    case 'house':
      return (
        <>
          <rect x={-7} y={-9} width={14} height={9} fill={col} />
          <rect x={3.6} y={-15} width={2} height={5} fill={dark} />
          <polygon points="-8.4,-9 0,-16.5 8.4,-9" fill={dark} />
          <rect x={-1.9} y={-5.6} width={3.8} height={5.6} fill={dark} />
          <circle cx={1.3} cy={-2.8} r={0.45} fill={col} />
          <rect x={-5.6} y={-7.2} width={2.8} height={2.8} fill={lit} />
          <rect x={3} y={-7.2} width={2.8} height={2.8} fill={lit} />
        </>
      );
    case 'bush':
      return (
        <>
          <circle cx={-3} cy={-2.4} r={3} fill={col} />
          <circle cx={0} cy={-3.6} r={3.6} fill={col} />
          <circle cx={3} cy={-2.6} r={2.8} fill={col} />
          <circle cx={-0.6} cy={-1.6} r={2.6} fill={col} />
          <circle cx={0.4} cy={-4.4} r={1.8} fill={leaf} />
        </>
      );
    case 'flower':
      return (
        <>
          <line x1={0} y1={0} x2={0} y2={-6.4} stroke={dark} strokeWidth={0.9} />
          <ellipse cx={-1.6} cy={-3.4} rx={1.3} ry={0.7} fill={leaf} />
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (k / 5) * Math.PI * 2;
            return (
              <circle
                key={k}
                cx={Math.cos(a) * 1.5}
                cy={-7 + Math.sin(a) * 1.5}
                r={1.1}
                fill={`hsl(${(hue + 300) % 360} 85% 72%)`}
              />
            );
          })}
          <circle cx={0} cy={-7} r={1.1} fill="hsl(48 100% 70%)" />
        </>
      );
    case 'deadtree':
      return (
        <g stroke={col} strokeWidth={1.1} fill="none" strokeLinecap="round">
          <line x1={0} y1={0} x2={0} y2={-15} />
          <line x1={0} y1={-9} x2={-5} y2={-14} />
          <line x1={-5} y1={-14} x2={-7} y2={-13} />
          <line x1={0} y1={-10} x2={4.6} y2={-15} />
          <line x1={4.6} y1={-15} x2={6} y2={-16.5} />
          <line x1={0} y1={-6} x2={-3.6} y2={-8.4} />
          <line x1={0} y1={-12.5} x2={1.6} y2={-17.5} />
        </g>
      );
    case 'ruin':
      return (
        <>
          <polygon points="-6,-10 -6,0 6,0 6,-7 4,-11 2,-7 0,-12.5 -2,-7 -4,-10.5" fill={col} />
          <rect x={-3.6} y={-5.6} width={2.8} height={5.6} fill={voidc} />
          <rect x={1.6} y={-7.4} width={2.6} height={2.8} fill={voidc} />
          <line x1={-6} y1={-3.4} x2={6} y2={-3.4} stroke={dark} strokeWidth={0.5} />
        </>
      );
    case 'grave':
      return (
        <>
          <ellipse cx={0} cy={-0.5} rx={4.6} ry={1.3} fill={dark} />
          <path d="M -2.8 0 L -2.8 -5.4 A 2.8 2.8 0 0 1 2.8 -5.4 L 2.8 0 Z" fill={col} />
          <line x1={-1.4} y1={-4} x2={1.4} y2={-4} stroke={dark} strokeWidth={0.5} />
          <line x1={-1.4} y1={-2.6} x2={1.4} y2={-2.6} stroke={dark} strokeWidth={0.5} />
        </>
      );
    case 'deadbush':
      return (
        <g stroke={col} strokeWidth={0.85} fill="none" strokeLinecap="round">
          <line x1={0} y1={0} x2={-3.2} y2={-4.4} />
          <line x1={-3.2} y1={-4.4} x2={-4.4} y2={-4} />
          <line x1={0} y1={0} x2={0} y2={-5} />
          <line x1={0} y1={-2.6} x2={2} y2={-4.4} />
          <line x1={0} y1={0} x2={3.2} y2={-3.8} />
        </g>
      );
    case 'rock':
    default:
      return (
        <>
          <ellipse cx={0} cy={-2.2} rx={4.4} ry={3} fill={col} />
          <ellipse cx={3} cy={-1.4} rx={2.4} ry={1.7} fill={dark} />
          <ellipse cx={-1.6} cy={-3.4} rx={1.6} ry={1.1} fill={leaf} />
        </>
      );
  }
}

/**
 * Scenery — a deterministic little landscape unique to each creature (per scenery.ts):
 * a horizon glow, two rolling hills, and a handful of props (trees, a cottage, rocks,
 * flowers for an Amabo; bare trees, a ruin, headstones for a Yim) placed far→near with
 * atmospheric perspective. Purely decorative, behind everything.
 */
function Scenery({ seed, uncanny }: { seed: number; uncanny: boolean }) {
  const hue = uncanny ? 254 : 32;
  const sat = uncanny ? 18 : 52;
  const scene = buildScene(seed, uncanny);
  return (
    <svg
      className="amarium-scenery"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <ellipse
        className="scenery-horizon"
        cx="50"
        cy="71"
        rx="52"
        ry="16"
        fill={`hsl(${hue} 92% 66%)`}
      />
      <path
        d="M0 70 Q 25 64 50 68 Q 75 72 100 66 L100 100 L0 100 Z"
        fill={`hsl(${hue} ${sat}% 44%)`}
        opacity="0.55"
      />
      <path
        d="M0 84 Q 35 78 60 82 Q 85 86 100 80 L100 100 L0 100 Z"
        fill={`hsl(${hue} ${sat}% 22%)`}
      />
      {scene.map((p, i) => {
        // Detailed silhouettes, bigger and lower as they near the foreground. An Amabo
        // silhouettes dark against its glow; a Yim has little backlight, so its props sit
        // a paler, ghostly lavender to stay readable against the bleak dark.
        const s = 0.85 + p.depth * 1.05;
        const baseY = 70 + p.depth * 14;
        const lum = uncanny ? 32 + (1 - p.depth) * 14 : 12 + (1 - p.depth) * 12;
        const pal: PropPalette = {
          col: `hsl(${hue} ${sat}% ${lum}%)`,
          dark: `hsl(${hue} ${sat}% ${Math.max(8, lum - 6)}%)`,
          leaf: `hsl(${hue} ${sat}% ${Math.min(64, lum + 9)}%)`,
          lit: 'hsl(45 100% 72%)',
          voidc: `hsl(${hue} ${sat}% 9%)`,
          hue,
          sat,
        };
        return (
          <g
            key={i}
            transform={`translate(${p.x.toFixed(2)} ${baseY.toFixed(2)}) scale(${((p.flip ? -1 : 1) * s).toFixed(3)} ${s.toFixed(3)})`}
            opacity={(0.8 + p.depth * 0.2).toFixed(2)}
          >
            {propShape(p.kind, pal)}
          </g>
        );
      })}
    </svg>
  );
}

function Atmosphere() {
  return (
    <div className="amarium-dust" aria-hidden="true">
      {DUST.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.s}px`,
            height: `${p.s}px`,
            animationDelay: `${p.d}s`,
            animationDuration: `${p.dur}s`,
          }}
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

  // The glass keeps the wall clock's hours: it cools and dims at night, and around
  // midnight a shooting star may cross (purely decorative; the engine's game-time is
  // separate). Sampled once per mount — re-checked whenever the screen reopens.
  const [{ night, witching }] = useState(() => nightMood(new Date()));

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

  // Tap the glass and it ripples where you touched; tap a living, awake creature and it
  // also giggles (a quick happy wiggle). Ripples are short-lived overlay rings.
  const [giggle, setGiggle] = useState(0);
  const rippleId = useRef(0);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const poke = (e: React.MouseEvent<HTMLDivElement>) => {
    if (creature?.state.alive && !creature.state.asleep) setGiggle((n) => n + 1);
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const id = (rippleId.current += 1);
    setRipples((rs) => [...rs, { x, y, id }]);
    window.setTimeout(() => setRipples((rs) => rs.filter((p) => p.id !== id)), 650);
  };

  // A living, awake creature ambles around its scene; a sleeping or gone one stays put.
  const roaming = !!creature?.state.alive && !creature.state.asleep;

  return (
    <div
      className={`amarium${night ? ' is-night' : ''}`}
      role="img"
      aria-label={
        creature
          ? `${creature.name}, a ${creature.state.uncanny ? 'Yim' : 'Amabo'} at the ${creature.state.stage} stage`
          : 'an empty, dark Amarium'
      }
      onPointerMove={track}
      onPointerLeave={release}
      onClick={creature ? poke : undefined}
      style={{ ['--ambra' as string]: intensity.toFixed(3) }}
    >
      <div className="amarium-glow" />
      {creature ? <Scenery seed={creature.state.seed} uncanny={creature.state.uncanny} /> : null}
      <div className="amarium-rays" aria-hidden="true" />
      {night ? <div className="amarium-night" aria-hidden="true" /> : null}
      {witching ? <div className="amarium-shootingstar" aria-hidden="true" /> : null}
      {creature ? <Atmosphere /> : null}
      {creature ? <div className="amarium-ground" aria-hidden="true" /> : null}
      {creature && creature.state.alive ? <Environment uncanny={creature.state.uncanny} /> : null}
      <div className={`amarium-sprite${climb ? ' is-popping' : ''}`}>
        {creature ? (
          // The roamer ambles slowly across the scene (each creature on its own path via
          // a seed-derived delay); the inner span keeps the tap-giggle independent.
          <div
            className={`amarium-roamer${roaming ? ' is-roaming' : ''}`}
            style={{
              ['--roam-delay' as string]: `${-(Math.abs(Math.trunc(creature.state.seed)) % 26)}s`,
            }}
          >
            <span className={giggle ? 'is-giggling' : undefined} key={giggle}>
              <Creature creature={creature} emote={emote} emoteNonce={emoteNonce} />
            </span>
          </div>
        ) : (
          <span className="amarium-empty">·</span>
        )}
      </div>
      {ripples.map((rp) => (
        <span
          key={rp.id}
          className="amarium-ripple"
          style={{ left: `${rp.x}%`, top: `${rp.y}%` }}
          aria-hidden="true"
        />
      ))}
      {climb ? <EvolveFlourish real={climb === 'real'} /> : null}
      <div className="amarium-vignette" aria-hidden="true" />
      <div className="amarium-glass" aria-hidden="true" />
      <div className="amarium-scanlines" aria-hidden="true" />
    </div>
  );
}
