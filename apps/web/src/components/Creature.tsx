/**
 * Creature.tsx — the polymorphic creature, drawn as SVG so it looks like *someone*
 * instead of a stray Unicode glyph (STORY.md §10: love has no shape; stage × disposition).
 * Amabo presentations are warm, round, and smiling; Yim presentations are pale and
 * uncanny (oversized eyes, a flat mouth). Size grows by stage; illness tints it; sleep
 * closes the eyes. Fully deterministic — no randomness.
 */

import type { CreatureViewT } from '@amabo/shared';
import type { Emote } from '../store/useGame.js';

const STAGE_SCALE: Record<string, number> = {
  mote: 0.55,
  spark: 0.7,
  velveteen: 0.85,
  bloom: 1,
};

/** Small floating particles per reaction (motes/sparkles/hearts), drawn in SVG space. */
function Particles({ emote }: { emote: Emote }) {
  const cx = 50;
  if (emote === 'feed') {
    return (
      <g className="fx-particles">
        {[-10, 0, 10].map((dx, i) => (
          <circle key={i} className="p-mote" cx={cx + dx} cy={86} r={3} fill="hsl(38 95% 62%)" />
        ))}
      </g>
    );
  }
  if (emote === 'clean') {
    return (
      <g className="fx-particles">
        {[18, 50, 82].map((x, i) => (
          <text key={i} className="p-spark" x={x} y={30 + (i % 2) * 10}>
            ✦
          </text>
        ))}
      </g>
    );
  }
  if (emote === 'play') {
    return (
      <g className="fx-particles">
        {[-12, 4, 14].map((dx, i) => (
          <text key={i} className="p-heart" x={cx + dx} y={40}>
            ♥
          </text>
        ))}
      </g>
    );
  }
  if (emote === 'comfort') {
    return (
      <circle className="p-ring" cx={cx} cy={56} r={20} fill="none" stroke="hsl(38 90% 70%)" />
    );
  }
  if (emote === 'peek') {
    return (
      <text className="p-spark" x={cx + 16} y={28}>
        ✦
      </text>
    );
  }
  return null;
}

export function Creature({
  creature,
  emote = null,
  emoteNonce = 0,
}: {
  creature: CreatureViewT;
  emote?: Emote | null;
  emoteNonce?: number;
}) {
  const { stage, uncanny, asleep, ill, alive } = creature.state;
  const ambra = Math.max(0, Math.min(100, creature.state.stats.ambra)) / 100;
  const scale = STAGE_SCALE[stage] ?? 1;

  // Palette: warm amber for an Amabo, pale lavender-grey for a Yim, dim when gone.
  const hue = uncanny ? 254 : 36;
  const sat = alive ? (uncanny ? 16 : 92) : 6;
  const light = !alive ? 32 : ill ? 52 : 60;
  const body = `hsl(${hue} ${sat}% ${light}%)`;
  const shade = `hsl(${hue} ${sat}% ${Math.max(20, light - 18)}%)`;
  const eyeR = uncanny ? 7.5 : 4.2; // Yim's enormous, quiet wanting
  const cx = 50;
  const cy = 52;
  const bodyR = 30 * scale;

  return (
    <svg
      className={`creature${asleep ? ' is-asleep' : ''}${uncanny ? ' is-yim' : ''}`}
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      role="presentation"
      style={{
        filter: alive
          ? `drop-shadow(0 0 ${(6 + 18 * ambra).toFixed(1)}px hsl(${hue} 90% 60% / ${(0.25 + 0.5 * ambra).toFixed(2)}))`
          : 'none',
      }}
    >
      {/* key on the nonce so the same reaction replays each time it fires */}
      <g className={`creature-float${emote ? ` fx-${emote}` : ''}`} key={emoteNonce}>
        {/* body */}
        <ellipse cx={cx} cy={cy + bodyR * 0.55} rx={bodyR} ry={bodyR * 0.9} fill={body} />
        {/* a soft tuft / antenna of light */}
        <line
          x1={cx}
          y1={cy - bodyR * 0.4}
          x2={cx}
          y2={cy - bodyR * 0.95}
          stroke={shade}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy - bodyR * 1.0} r={2.6} fill={`hsl(${hue} 95% 72%)`} />

        {/* eyes */}
        {asleep ? (
          <>
            <path d={eyeArc(cx - 9, cy + 4)} stroke={shade} strokeWidth={2} fill="none" />
            <path d={eyeArc(cx + 9, cy + 4)} stroke={shade} strokeWidth={2} fill="none" />
            <text x={cx + bodyR * 0.7} y={cy - bodyR * 0.5} className="creature-z">
              z
            </text>
          </>
        ) : (
          <>
            <circle cx={cx - 9} cy={cy + 2} r={eyeR} fill="#241a12" />
            <circle cx={cx + 9} cy={cy + 2} r={eyeR} fill="#241a12" />
            {/* catchlights — a Yim's are tiny and cold */}
            <circle cx={cx - 9 + eyeR * 0.3} cy={cy + 2 - eyeR * 0.3} r={eyeR * 0.3} fill="#fff" />
            <circle cx={cx + 9 + eyeR * 0.3} cy={cy + 2 - eyeR * 0.3} r={eyeR * 0.3} fill="#fff" />
          </>
        )}

        {/* mouth: Amabo smiles; Yim is a flat, longing line; sleeping is a tiny rest */}
        {!asleep &&
          (uncanny ? (
            <line
              x1={cx - 6}
              y1={cy + 16}
              x2={cx + 6}
              y2={cy + 16}
              stroke={shade}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          ) : (
            <path
              d={`M ${cx - 7} ${cy + 13} Q ${cx} ${cy + 19} ${cx + 7} ${cy + 13}`}
              stroke={shade}
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
            />
          ))}

        {/* illness: a small bead of sweat */}
        {ill && alive ? <circle cx={cx + bodyR * 0.6} cy={cy} r={2.2} fill="#7fd1a0" /> : null}

        {/* reaction particles */}
        {emote ? <Particles emote={emote} /> : null}
      </g>
    </svg>
  );
}

function eyeArc(x: number, y: number): string {
  return `M ${x - 4} ${y} Q ${x} ${y + 4} ${x + 4} ${y}`;
}
