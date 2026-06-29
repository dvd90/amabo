/**
 * PixelCreature.tsx — an alternate, pixel-art rendering of the creature (an opt-in skin).
 * It mirrors the smooth <Creature>'s anatomy on a low-resolution grid: same param mapping
 * (stage scales it, a Yim is taller/narrower with enormous eyes, hue follows disposition,
 * the seed varies hue + ears), so it is the *same soul*, just rendered in chunky pixels.
 *
 * Pure (props only, deterministic — no store, no Date/Math.random beyond the seeded
 * variation), so it composes anywhere the smooth creature does, including the share card.
 * Reversible by construction: <Creature> delegates here only when Pixel mode is on.
 */

import type { ReactElement } from 'react';
import { STAGES, type CreatureViewT } from '@amabo/shared';

const STAGE_SCALE: Record<string, number> = {
  mote: 0.62,
  spark: 0.74,
  velveteen: 0.88,
  bloom: 1,
};

/** Deterministic per-creature variation (pure). */
function vary(seed: number) {
  let x = (Math.abs(Math.trunc(seed)) * 2654435761 + 12345) >>> 0;
  const n = () => ((x = (x * 1664525 + 1013904223) >>> 0), x / 4294967296);
  return { hueShift: Math.round((n() * 2 - 1) * 8), ears: n() < 0.5 ? 1 : 2 };
}

const GRID = 22; // the balanced resolution from the idea sweep

export function PixelCreature({ creature }: { creature: CreatureViewT }) {
  const { stage, uncanny, asleep, ill, alive, seed } = creature.state;
  const v = vary(seed);
  const s = 100 / GRID;
  const stageIdx = STAGES.indexOf(stage);
  const scale = STAGE_SCALE[stage] ?? 1;

  // Palette — amber Amabo / lavender Yim / dim when ill or gone.
  const hue = (uncanny ? 254 : 36) + v.hueShift;
  const sat = !alive ? 8 : uncanny ? 18 : 92;
  const lightL = !alive ? 34 : ill ? 52 : 62;
  const base = `hsl(${hue} ${sat}% ${lightL}%)`;
  const litC = `hsl(${hue} ${Math.min(100, sat + 6)}% ${Math.min(92, lightL + 20)}%)`;
  const shade = `hsl(${hue} ${sat}% ${Math.max(22, lightL - 20)}%)`;
  const ink = `hsl(${hue} ${Math.min(40, sat)}% ${Math.max(12, lightL - 44)}%)`;
  const tip = `hsl(${hue} 95% 74%)`;

  const cx = 50;
  const bodyR = 34 * scale;
  const rx = bodyR * (uncanny ? 0.78 : 1);
  const ry = bodyR * (uncanny ? 1.16 : 0.94);
  const cy = 54 + (1 - scale) * 6;
  const lpx = cx - rx * 0.4; // light source (top-left) for 3-tone shading
  const lpy = cy - ry * 0.5;

  const rects: ReactElement[] = [];
  let k = 0;
  const px = (i: number) => i * s;
  const fullCell = (i: number, j: number, fill: string) =>
    rects.push(
      <rect
        key={k++}
        x={px(i).toFixed(2)}
        y={px(j).toFixed(2)}
        width={s.toFixed(2)}
        height={s.toFixed(2)}
        fill={fill}
      />,
    );
  // a partial cell (for pupils / glints), centred in the cell at pixel coords
  const dot = (cxp: number, cyp: number, size: number, fill: string) =>
    rects.push(
      <rect
        key={k++}
        x={(cxp - (s * size) / 2).toFixed(2)}
        y={(cyp - (s * size) / 2).toFixed(2)}
        width={(s * size).toFixed(2)}
        height={(s * size).toFixed(2)}
        fill={fill}
      />,
    );
  const cellAt = (cxp: number, cyp: number, fill: string) =>
    fullCell(Math.floor(cxp / s), Math.floor(cyp / s), fill);

  const inBody = (i: number, j: number) => {
    const x = (i + 0.5) * s;
    const y = (j + 0.5) * s;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  };

  // 1) outline ring
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      if (inBody(i, j)) continue;
      if (inBody(i - 1, j) || inBody(i + 1, j) || inBody(i, j - 1) || inBody(i, j + 1))
        fullCell(i, j, ink);
    }
  // 2) body, 3-tone shaded
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      if (!inBody(i, j)) continue;
      const x = (i + 0.5) * s;
      const y = (j + 0.5) * s;
      const d = Math.hypot(x - lpx, y - lpy) / (Math.max(rx, ry) * 1.5);
      fullCell(i, j, d < 0.42 ? litC : d > 0.82 ? shade : base);
    }

  // 3) ears (velveteen+)
  if (stageIdx >= 2) {
    const ey = cy - ry * 0.72;
    cellAt(cx - rx * 0.62, ey, shade);
    cellAt(cx - rx * 0.62, ey - s, shade);
    if (v.ears >= 2) {
      cellAt(cx + rx * 0.55, ey, shade);
      cellAt(cx + rx * 0.55, ey - s, shade);
    }
  }
  // 4) antenna (spark+)
  if (stageIdx >= 1) {
    const topY = cy - ry;
    cellAt(cx, topY - s, shade);
    cellAt(cx, topY - s * 2, shade);
    cellAt(cx, topY - s * 3, tip);
  }

  // 5) eyes — Amabo small & bright; Yim enormous (the quiet wanting); asleep = soft line
  const eyeY = cy - ry * 0.1;
  const eyeDx = rx * (uncanny ? 0.4 : 0.42);
  const white = uncanny ? '#e8e3f2' : '#fffaf0';
  const eye = (exCenter: number) => {
    if (asleep) {
      cellAt(exCenter - s * 0.5, eyeY, ink);
      cellAt(exCenter + s * 0.5, eyeY, ink);
      return;
    }
    if (uncanny) {
      for (const dx of [-0.5, 0.5])
        for (const dy of [-0.5, 0.5]) cellAt(exCenter + dx * s, eyeY + dy * s, white);
      dot(exCenter, eyeY + s * 0.2, 0.7, ink); // a low, hollow pupil
    } else {
      cellAt(exCenter, eyeY, white);
      dot(exCenter + s * 0.15, eyeY + s * 0.2, 0.55, ink);
      dot(exCenter - s * 0.18, eyeY - s * 0.15, 0.28, '#ffffff'); // glint
    }
  };
  eye(cx - eyeDx);
  eye(cx + eyeDx);

  // 6) mouth (spark+) — a small smile for an Amabo, a flat longing line for a Yim
  if (stageIdx >= 1 && !asleep) {
    const my = cy + ry * 0.32;
    if (uncanny) {
      cellAt(cx - s, my, ink);
      cellAt(cx, my, ink);
      cellAt(cx + s, my, ink);
    } else {
      cellAt(cx - s * 1.3, my - s, ink); // corner up
      cellAt(cx - s * 0.3, my, ink);
      cellAt(cx + s * 0.7, my, ink);
      cellAt(cx + s * 1.5, my - s, ink); // corner up
    }
  }

  return (
    <svg
      className={`creature pixel-creature${uncanny ? ' is-yim' : ''}`}
      data-stage={stage}
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      role="presentation"
      style={{
        filter: alive ? `drop-shadow(0 0 6px hsl(${hue} 90% 60% / 0.45))` : 'none',
      }}
    >
      {rects}
    </svg>
  );
}
