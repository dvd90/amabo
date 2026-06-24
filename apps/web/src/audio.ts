/**
 * audio.ts — tiny Web Audio cues (ARCHITECTURE.md §10): button blips, a soft chord
 * swell on graduation. Kept dependency-free and lazily created on first use (browsers
 * require a user gesture). All calls are no-ops when muted or off the main thread, so
 * tests and SSR never touch the Audio API.
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

function tone(freq: number, durationMs: number, gain = 0.04): void {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(ac.destination);
  const now = ac.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function blip(muted: boolean): void {
  if (muted) return;
  tone(660, 60);
}

/** A soft major chord swell for graduation — the ascension chime. */
export function graduationSwell(muted: boolean): void {
  if (muted) return;
  [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 700, 0.05), i * 90));
}
