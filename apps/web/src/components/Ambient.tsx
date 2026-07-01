/**
 * Ambient.tsx — the living air of the app (STORY.md §1: unspent love drifts and pools
 * as Ambra). A fixed, non-interactive layer behind every screen: slow-drifting motes
 * of light, a soft vignette, and a whisper of film grain — so the world never feels
 * static even before a single creature is on screen. Tinted by the active theme via
 * the --amber variable; fully disabled under prefers-reduced-motion (the motes hold
 * still and simply glow).
 *
 * Deterministic (no Math.random at render): each mote's position, size, duration and
 * delay derive from its index, so SSR/tests are stable and there is no hydration drift.
 */

const MOTE_COUNT = 26;

/** A tiny deterministic hash → [0, 1) per (index, salt). Pure. */
function n(i: number, salt: number): number {
  let x = (i * 374761393 + salt * 668265263) >>> 0;
  x = (x ^ (x >> 13)) >>> 0;
  x = (x * 1274126177) >>> 0;
  return ((x ^ (x >> 16)) >>> 0) / 4294967296;
}

export function Ambient() {
  const motes = Array.from({ length: MOTE_COUNT }, (_, i) => ({
    left: n(i, 1) * 100,
    top: n(i, 2) * 100,
    size: 1.5 + n(i, 3) * 3.5,
    // Long, varied cycles so the field never visibly loops in unison.
    duration: 14 + n(i, 4) * 22,
    delay: -n(i, 5) * 30,
    opacity: 0.25 + n(i, 6) * 0.5,
  }));

  return (
    <div className="ambient" aria-hidden="true">
      {motes.map((m, i) => (
        <span
          key={i}
          className="ambient-mote"
          style={{
            left: `${m.left.toFixed(2)}%`,
            top: `${m.top.toFixed(2)}%`,
            width: `${m.size.toFixed(2)}px`,
            height: `${m.size.toFixed(2)}px`,
            animationDuration: `${m.duration.toFixed(1)}s`,
            animationDelay: `${m.delay.toFixed(1)}s`,
            opacity: m.opacity,
          }}
        />
      ))}
      <div className="ambient-vignette" />
      <div className="ambient-grain" />
    </div>
  );
}
