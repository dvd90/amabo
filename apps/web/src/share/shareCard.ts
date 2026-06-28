/**
 * share/shareCard.ts — the shareable journal card (the viral artifact, GTM #3). Turns a
 * creature's diary entry into a beautiful image the Light can post — every share shows the
 * real product (a moving, AI/locally-written inner life). Rendered client-side on a canvas
 * (no server, works offline): paint the world, rasterise the creature's own SVG, lay the
 * entry in a diary serif, then hand it to the Web Share API (with a download fallback).
 */

export type CardFormat = 'story' | 'square';

export const CARD_SIZES: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 }, // 9:16 — Reels / TikTok / IG & WhatsApp stories
  square: { w: 1080, h: 1080 }, // 1:1 — Reddit / Product Hunt / X
};

export interface CardOpts {
  name: string;
  journal: string;
  mood: string;
  uncanny: boolean;
  /** mote · spark · velveteen · bloom — shown as a small subtitle. */
  stage: string;
  format: CardFormat;
}

/** A safe download filename for the card. Pure. */
export function cardFilename(name: string, format: CardFormat): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'amabo';
  return `${slug}-${format}.png`;
}

/** Greedy word-wrap to fit a max width, measured by the injected measurer. Pure & testable. */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && measure(next) > maxWidth) {
        lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    lines.push(cur);
  }
  return lines;
}

/** The two worlds' palettes (a radiant Amabo vs a longing Yim). Pure. */
export function cardPalette(uncanny: boolean) {
  return uncanny
    ? {
        top: '#1a1822',
        bottom: '#0e0d14',
        glow: 'hsl(265 60% 70%)',
        ink: '#efe9f6',
        dim: '#b9aecb',
      }
    : {
        top: '#241a10',
        bottom: '#120d08',
        glow: 'hsl(40 95% 62%)',
        ink: '#f6efe2',
        dim: '#caa86a',
      };
}

/** Make a serialised creature SVG loadable as an image: ensure namespace + fixed size. */
function normaliseSvg(svg: string, size: number): string {
  let out = svg;
  if (!/xmlns=/.test(out)) out = out.replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg"`);
  // Replace the on-screen 100%/responsive sizing with a fixed pixel box for rasterisation.
  out = out
    .replace(/\swidth="[^"]*"/, ` width="${size}"`)
    .replace(/\sheight="[^"]*"/, ` height="${size}"`);
  if (!/width=/.test(out)) out = out.replace('<svg', `<svg width="${size}" height="${size}"`);
  return out;
}

function loadSvg(svg: string, size: number): Promise<HTMLImageElement> {
  const blob = new Blob([normaliseSvg(svg, size)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  }).then((img) => {
    URL.revokeObjectURL(url);
    return img as HTMLImageElement;
  });
}

/**
 * Compose and rasterise the card. Returns a PNG blob, or null if the canvas isn't available
 * (e.g. during SSR / tests without a 2D context).
 */
export async function renderCardBlob(creatureSvg: string, opts: CardOpts): Promise<Blob | null> {
  const { w, h } = CARD_SIZES[opts.format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const pal = cardPalette(opts.uncanny);

  // The world: a vertical wash, with a soft glow behind where the creature sits.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, pal.top);
  bg.addColorStop(1, pal.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Lay the card out top-down with a running vertical cursor (no overlaps in either ratio).
  const artSize = Math.round(Math.min(w * 0.5, h * 0.26));
  const artTop = h * 0.12;
  const artCy = artTop + artSize / 2;

  const glow = ctx.createRadialGradient(w / 2, artCy, 40, w / 2, artCy, w * 0.55);
  glow.addColorStop(0, hexish(pal.glow, 0.28));
  glow.addColorStop(1, hexish(pal.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // The creature, from its own SVG.
  try {
    const img = await loadSvg(creatureSvg, artSize);
    ctx.drawImage(img, (w - artSize) / 2, artTop, artSize, artSize);
  } catch {
    /* no art — the words still carry the card */
  }

  ctx.textAlign = 'center';

  // Kicker (top).
  ctx.fillStyle = pal.dim;
  ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('THE  AMARIUM', w / 2, h * 0.075);

  // Name · who it is — below the art.
  let y = artTop + artSize + 78;
  ctx.fillStyle = pal.ink;
  ctx.font = '700 58px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(opts.name, w / 2, y);
  y += 46;
  ctx.fillStyle = pal.dim;
  ctx.font = '400 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${opts.uncanny ? 'Yim' : 'Amabo'} · ${opts.stage}`, w / 2, y);

  // The diary entry — the hero. A serif, italic, wrapped, flowing downward from here.
  const quoteSize = opts.format === 'story' ? 58 : 50;
  ctx.font = `italic 400 ${quoteSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = pal.ink;
  const lines = wrapLines(`“${opts.journal}”`, w * 0.82, (s) => ctx.measureText(s).width);
  const lineH = quoteSize * 1.4;
  y += quoteSize + 70;
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, y + i * lineH));
  y += lines.length * lineH;

  // Mood.
  ctx.fillStyle = pal.dim;
  ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`— ${opts.mood} —`, w / 2, y + 18);

  // Footer wordmark (anchored to the bottom).
  ctx.fillStyle = pal.ink;
  ctx.font = '800 40px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Amabo ✦', w / 2, h - 92);
  ctx.fillStyle = pal.dim;
  ctx.font = '400 28px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('a creature with an inner life', w / 2, h - 50);

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Tint a hsl()/hex-ish colour with an alpha for canvas gradients. */
function hexish(color: string, alpha: number): string {
  if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', ` / ${alpha})`);
  return color;
}

/** Share the card via the Web Share API where possible; otherwise save it. */
export async function shareOrSaveCard(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'saved'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; text?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], text });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'saved';
}
