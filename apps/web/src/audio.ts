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

// ── Ambient background pad (the "music") ─────────────────────────────────────────
// A soft, slowly-breathing amber drone built from a few detuned oscillators. Generated
// (no audio file to ship) and gentle enough to live under the whole experience.
let ambient: { osc: OscillatorNode[]; gain: GainNode; lfo: OscillatorNode } | null = null;

/** A warm, open voicing (root, fifth, octave, major third up high) — calm, not sad. */
const AMBIENT_CHORD = [110, 164.81, 220, 277.18];

export function startAmbient(): void {
  const ac = audioCtx();
  if (!ac || ambient) return;
  void ac.resume?.();

  const master = ac.createGain();
  master.gain.value = 0.0;
  master.connect(ac.destination);

  const osc = AMBIENT_CHORD.map((freq, i) => {
    const o = ac.createOscillator();
    o.type = i === AMBIENT_CHORD.length - 1 ? 'triangle' : 'sine';
    o.frequency.value = freq;
    o.detune.value = (i - 1.5) * 4; // a little chorus
    o.connect(master);
    o.start();
    return o;
  });

  // Slow swell so it "breathes" rather than drones flatly.
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 0.06; // ~16s cycle
  lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start();

  master.gain.linearRampToValueAtTime(0.05, ac.currentTime + 3); // gentle fade-in
  ambient = { osc, gain: master, lfo };
}

export function stopAmbient(): void {
  const ac = audioCtx();
  if (!ac || !ambient) return;
  const { osc, gain, lfo } = ambient;
  gain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.6);
  setTimeout(() => {
    osc.forEach((o) => o.stop());
    lfo.stop();
  }, 700);
  ambient = null;
}

export function setAmbient(on: boolean): void {
  if (on) startAmbient();
  else stopAmbient();
}

/** A soft major chord swell for graduation — the ascension chime. */
export function graduationSwell(muted: boolean): void {
  if (muted) return;
  [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 700, 0.05), i * 90));
}
