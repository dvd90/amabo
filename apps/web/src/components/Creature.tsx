/**
 * Creature.tsx — the polymorphic creature (STORY.md §1, §10: love has no shape; the
 * sprite is stage × disposition). Drawn as deterministic SVG so it reads as *someone*:
 *  - Stage sculpts the silhouette: a Mote is a bare glowing orb; a Spark grows an
 *    antenna; a Velveteen fills out and grows soft ears; a Bloom is fully itself.
 *  - Disposition sculpts the feeling: an Amabo is round, warm and smiling; a Yim is
 *    taller, paler and uncanny (oversized eyes, a flat longing mouth).
 *  - A per-seed variation (deterministic, no randomness) gives each one its own tilt,
 *    hue and ears, so two creatures of the same stage still look like different souls.
 * Illness tints; sleep closes the eyes; ambra drives the glow.
 */

import { STAGES, type CreatureViewT } from '@amabo/shared';
import type { Emote } from '../store/useGame.js';
import { nameEgg, type NameEgg } from '../eggs.js';
import { isIridescent } from '../worldtime.js';

const STAGE_SCALE: Record<string, number> = {
  mote: 0.5,
  spark: 0.68,
  velveteen: 0.85,
  bloom: 1,
};

/** Deterministic per-creature variation from the seed (pure: no Math.random). */
function variation(seed: number) {
  let x = (Math.abs(Math.trunc(seed)) * 2654435761 + 12345) >>> 0;
  const next = () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
  const earRoll = next();
  return {
    hueShift: Math.round((next() * 2 - 1) * 8), // ±8°
    tilt: (next() * 2 - 1) * 3, // ±3° personality lean
    earsSeed: earRoll < 0.5 ? 1 : 2, // 1–2 ears once they grow in
    tuft: 0.85 + next() * 0.4, // antenna length factor
  };
}

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
        {[18, 50, 82].map((px, i) => (
          <text key={i} className="p-spark" x={px} y={30 + (i % 2) * 10}>
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

/** Geometry the egg marks need to attach themselves to the right spot on the face/body. */
type Geo = {
  cx: number;
  eyeY: number;
  eyeDx: number;
  rx: number;
  ry: number;
  bodyCy: number;
  shade: string;
};

/**
 * A quiet nod for a creature named after a touchstone (STORY.md §11): a worn seam for a
 * Velveteen, a long nose for Pinocchio, a wink for Galatea, neck bolts for Frankenstein,
 * a tiny perched raven for Nevermore. Drawn over the body; original art, not the source.
 */
function NameEggMark({ egg, geo }: { egg: NameEgg; geo: Geo }) {
  const { cx, eyeY, eyeDx, rx, ry, bodyCy, shade } = geo;
  if (egg === 'velveteen') {
    // a worn stitched seam — loved soft, becoming Real
    return (
      <line
        className="egg-velveteen"
        x1={cx - rx * 0.5}
        y1={bodyCy + ry * 0.18}
        x2={cx + rx * 0.5}
        y2={bodyCy + ry * 0.1}
        stroke={shade}
        strokeWidth={1.2}
        strokeDasharray="2 2"
        strokeLinecap="round"
      />
    );
  }
  if (egg === 'pinocchio') {
    return (
      <line
        className="egg-pinocchio"
        x1={cx}
        y1={eyeY + 5}
        x2={cx + rx * 0.7}
        y2={eyeY + 4}
        stroke={shade}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    );
  }
  if (egg === 'galatea') {
    // a wink — the one who finally looks back (Pygmalion)
    return (
      <path
        className="egg-galatea"
        d={`M ${cx - eyeDx - 4} ${eyeY} Q ${cx - eyeDx} ${eyeY + 4} ${cx - eyeDx + 4} ${eyeY}`}
        stroke={shade}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  if (egg === 'frankenstein') {
    return (
      <g className="egg-frankenstein" fill={shade}>
        <rect x={cx - rx * 0.78} y={bodyCy - 2} width={3} height={6} rx={1} />
        <rect x={cx + rx * 0.78 - 3} y={bodyCy - 2} width={3} height={6} rx={1} />
      </g>
    );
  }
  // raven — perched, longing (Poe)
  return (
    <path
      className="egg-raven"
      d={`M ${cx - 6} ${eyeY - ry * 0.62} q 5 -3 9 0 q -2 -4 3 -5 q -2 3 2 4 q 4 -1 5 -4 q -1 6 -7 7 q -7 1 -12 1 z`}
      fill={shade}
      transform={`translate(${rx * 0.3} 0)`}
    />
  );
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
  const { stage, uncanny, asleep, ill, alive, seed, traits } = creature.state;
  const ambra = Math.max(0, Math.min(100, creature.state.stats.ambra)) / 100;
  const scale = STAGE_SCALE[stage] ?? 1;
  const stageIdx = STAGES.indexOf(stage);
  const v = variation(seed);

  // Stage gates the anatomy.
  const showAntenna = stageIdx >= 1; // Spark and up
  const showMouth = stageIdx >= 1;
  const showEars = stageIdx >= 2; // Velveteen and up
  const ears = showEars ? v.earsSeed : 0;
  const trait = Object.keys(traits ?? {}).length > 0; // a distinguishing mark, if any
  const egg = alive ? nameEgg(creature.name) : null; // a nod for a canon-named creature
  // A rare iridescent Mote — a one-in-many shimmering soul (STORY.md §11).
  const iridescent = alive && stage === 'mote' && isIridescent(seed);

  // Palette: warm amber for an Amabo, pale lavender-grey for a Yim, dim when gone.
  const hue = (uncanny ? 254 : 36) + v.hueShift;
  const sat = alive ? (uncanny ? 16 : 92) : 6;
  const light = !alive ? 32 : ill ? 52 : 60;
  const body = `hsl(${hue} ${sat}% ${light}%)`;
  const shade = `hsl(${hue} ${sat}% ${Math.max(20, light - 18)}%)`;
  const tuftTip = `hsl(${hue} 95% 72%)`;

  // Idle posture: droops & dims when its inner light is low, drowsy when tired.
  const energy = creature.state.stats.energy;
  const tired = alive && !asleep && energy < 25;
  const dim = alive && !asleep && ambra < 0.25;
  // A per-creature blink rhythm so a row of them doesn't blink in unison.
  const blinkDelay = -((Math.abs(Math.trunc(seed)) % 55) / 10);

  const eyeR = uncanny ? 7.6 : 4.2; // a Yim's enormous, quiet wanting
  const cx = 50;
  const cy = 52;
  const bodyR = 30 * scale;
  // Disposition sculpts the silhouette: Amabo round; Yim taller and narrower (uncanny).
  const rx = bodyR * (uncanny ? 0.8 : 1);
  const ry = bodyR * (uncanny ? 1.12 : 0.92);
  const bodyCy = cy + ry * 0.5;
  const eyeDx = 9 * (uncanny ? 0.85 : 1);
  const eyeY = bodyCy - ry * 0.45;

  return (
    <svg
      className={`creature${asleep ? ' is-asleep' : ''}${uncanny ? ' is-yim' : ''}${tired ? ' is-tired' : ''}${dim ? ' is-dim' : ''}${iridescent ? ' is-iridescent' : ''}`}
      data-stage={stage}
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
        {/* a static personality lean (kept off the float group so emotes still animate) */}
        <g transform={`rotate(${v.tilt.toFixed(2)} ${cx} ${bodyCy})`}>
          {/* soft ears (Velveteen and up) */}
          {ears >= 1 ? (
            <ellipse
              className="creature-ear"
              cx={cx - rx * 0.55}
              cy={bodyCy - ry * 0.55}
              rx={rx * 0.22}
              ry={ry * 0.3}
              fill={shade}
            />
          ) : null}
          {ears >= 2 ? (
            <ellipse
              className="creature-ear"
              cx={cx + rx * 0.55}
              cy={bodyCy - ry * 0.55}
              rx={rx * 0.22}
              ry={ry * 0.3}
              fill={shade}
            />
          ) : null}

          {/* body */}
          <ellipse cx={cx} cy={bodyCy} rx={rx} ry={ry} fill={body} />

          {/* antenna / tuft of light (Spark and up) */}
          {showAntenna ? (
            <>
              <line
                className="creature-antenna"
                x1={cx}
                y1={cy - ry * 0.25}
                x2={cx}
                y2={cy - ry * 0.7 * v.tuft}
                stroke={shade}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle cx={cx} cy={cy - ry * 0.7 * v.tuft - 2} r={2.6} fill={tuftTip} />
            </>
          ) : null}

          {/* eyes */}
          {asleep ? (
            <>
              <path d={eyeArc(cx - eyeDx, eyeY)} stroke={shade} strokeWidth={2} fill="none" />
              <path d={eyeArc(cx + eyeDx, eyeY)} stroke={shade} strokeWidth={2} fill="none" />
              <text x={cx + rx * 0.7} y={cy - ry * 0.3} className="creature-z">
                z
              </text>
            </>
          ) : (
            // .creature-eyes blinks (scaleY); .creature-gaze drifts toward the last
            // tap (--look-x/--look-y) so the creature looks back at the Light.
            <g className="creature-eyes" style={{ animationDelay: `${blinkDelay}s` }}>
              <g className="creature-gaze">
                <circle cx={cx - eyeDx} cy={eyeY} r={eyeR} fill="#241a12" />
                <circle cx={cx + eyeDx} cy={eyeY} r={eyeR} fill="#241a12" />
                <circle
                  cx={cx - eyeDx + eyeR * 0.3}
                  cy={eyeY - eyeR * 0.3}
                  r={eyeR * 0.3}
                  fill="#fff"
                />
                <circle
                  cx={cx + eyeDx + eyeR * 0.3}
                  cy={eyeY - eyeR * 0.3}
                  r={eyeR * 0.3}
                  fill="#fff"
                />
              </g>
            </g>
          )}

          {/* mouth: Amabo smiles; Yim is a flat, longing line (a Mote has none yet) */}
          {!asleep && showMouth ? (
            uncanny ? (
              <line
                x1={cx - 6}
                y1={eyeY + 14}
                x2={cx + 6}
                y2={eyeY + 14}
                stroke={shade}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            ) : (
              <path
                d={`M ${cx - 7} ${eyeY + 11} Q ${cx} ${eyeY + 17} ${cx + 7} ${eyeY + 11}`}
                stroke={shade}
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
              />
            )
          ) : null}

          {/* a distinguishing trait mark, if the creature has earned any */}
          {trait && alive ? (
            <text className="creature-trait" x={cx - rx * 0.62} y={bodyCy + ry * 0.2}>
              ✦
            </text>
          ) : null}

          {/* illness: a small bead */}
          {ill && alive ? <circle cx={cx + rx * 0.6} cy={bodyCy} r={2.2} fill="#7fd1a0" /> : null}

          {/* a quiet nod for a creature named after a touchstone */}
          {egg && !asleep ? (
            <NameEggMark egg={egg} geo={{ cx, eyeY, eyeDx, rx, ry, bodyCy, shade }} />
          ) : null}
        </g>

        {/* reaction particles */}
        {emote ? <Particles emote={emote} /> : null}
      </g>
    </svg>
  );
}

function eyeArc(x: number, y: number): string {
  return `M ${x - 4} ${y} Q ${x} ${y + 4} ${x + 4} ${y}`;
}
