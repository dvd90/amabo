/**
 * Amarium.tsx — the LCD: a dot-matrix amber world whose glow tracks ambient Ambra
 * (STORY.md §3, ARCHITECTURE.md §10). Scanlines + faint tint; the creature sprite is
 * stage × disposition. Respects prefers-reduced-motion via CSS.
 */

import type { CreatureViewT } from '@amabo/shared';
import { Creature } from './Creature.js';
import { glow } from './sprite.js';
import { useGame } from '../store/useGame.js';

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
  return (
    <div
      className="amarium"
      role="img"
      aria-label={
        creature
          ? `${creature.name}, a ${creature.state.uncanny ? 'Yim' : 'Amabo'} at the ${creature.state.stage} stage`
          : 'an empty, dark Amarium'
      }
      style={{ ['--ambra' as string]: intensity.toFixed(3) }}
    >
      <div className="amarium-glow" />
      {creature && creature.state.alive ? <Environment uncanny={creature.state.uncanny} /> : null}
      <div className="amarium-sprite">
        {creature ? (
          <Creature creature={creature} emote={emote} emoteNonce={emoteNonce} />
        ) : (
          <span className="amarium-empty">·</span>
        )}
      </div>
      <div className="amarium-scanlines" aria-hidden="true" />
    </div>
  );
}
