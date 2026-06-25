/**
 * Creature.tsx — the polymorphic creature, drawn as SVG so it looks like *someone*
 * instead of a stray Unicode glyph (STORY.md §10: love has no shape; stage × disposition).
 * Amabo presentations are warm, round, and smiling; Yim presentations are pale and
 * uncanny (oversized eyes, a flat mouth). Size grows by stage; illness tints it; sleep
 * closes the eyes. Fully deterministic — no randomness.
 */

import type { CreatureViewT } from '@amabo/shared';

const STAGE_SCALE: Record<string, number> = {
  mote: 0.55,
  spark: 0.7,
  velveteen: 0.85,
  bloom: 1,
};

export function Creature({ creature }: { creature: CreatureViewT }) {
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
      <g className="creature-float">
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
      </g>
    </svg>
  );
}

function eyeArc(x: number, y: number): string {
  return `M ${x - 4} ${y} Q ${x} ${y + 4} ${x + 4} ${y}`;
}
