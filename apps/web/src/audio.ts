/**
 * audio.ts — sound for the device (ARCHITECTURE.md §10). Two parts:
 *  - SFX: button blips + a graduation chord swell.
 *  - MUSIC: a generative lo-fi soundtrack — a real lookahead scheduler playing a sparse
 *    music-box melody + bass + pad, all drawn from a pentatonic scale (always consonant)
 *    through a low-pass for warmth. Mood-reactive: warm major for an Amabo, wistful minor
 *    (with a faint stopped-clock tick) for a Yim.
 *
 * Dependency-free Web Audio, lazily created on first use (browsers require a gesture).
 * All calls are no-ops off the main thread, so tests/SSR never touch the Audio API.
 */

import { bassHz, hz, pickFreq, ROOT_HZ, type Mood } from './audio/theory.js';

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

// ── Generative lo-fi soundtrack ──────────────────────────────────────────────────
const BPM = 64;
const STEP_SECONDS = 60 / BPM / 2; // eighth-note grid
const LOOKAHEAD_S = 0.12;
const TICK_MS = 30;

interface MusicGraph {
  master: GainNode;
  lopass: BiquadFilterNode;
}

let graph: MusicGraph | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextNoteTime = 0;
let step = 0;
let mood: Mood = 'amabo';

function ensureGraph(ac: AudioContext): MusicGraph {
  if (graph) return graph;
  const master = ac.createGain();
  master.gain.value = 0.0001;
  const lopass = ac.createBiquadFilter();
  lopass.type = 'lowpass';
  lopass.frequency.value = 1500; // lo-fi warmth
  master.connect(lopass).connect(ac.destination);
  graph = { master, lopass };
  return graph;
}

/** One plucked/bell voice through the music bus. */
function voice(
  ac: AudioContext,
  bus: AudioNode,
  freq: number,
  when: number,
  dur: number,
  peak: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g).connect(bus);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.02); // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur); // long decay
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function scheduleStep(ac: AudioContext, bus: AudioNode, i: number, t: number): void {
  // Bass: root, once per bar (8 eighth-notes).
  if (i % 8 === 0) voice(ac, bus, bassHz(mood), t, 1.8, 0.12);
  // Pad: an open chord every two bars.
  if (i % 16 === 0) {
    for (const s of [0, 7, 12]) voice(ac, bus, hz(ROOT_HZ[mood], s), t, 3.6, 0.025, 'triangle');
  }
  // Melody: sparse music-box, an octave up. Denser when radiant, sparse when soured.
  const density = mood === 'amabo' ? 0.42 : 0.28;
  if (Math.random() < density) {
    voice(ac, bus, pickFreq(mood, Math.random(), 2) * 2, t, 0.7, 0.05);
  }
  // A Yim keeps a faint stopped-clock tick on the beat.
  if (mood === 'yim' && i % 4 === 0) voice(ac, bus, 2200, t, 0.04, 0.015, 'square');
}

export function setMusicMood(next: Mood): void {
  mood = next;
  const ac = audioCtx();
  if (ac && graph)
    graph.lopass.frequency.setTargetAtTime(next === 'yim' ? 1100 : 1600, ac.currentTime, 0.5);
}

export function startMusic(): void {
  const ac = audioCtx();
  if (!ac || timer) return;
  void ac.resume?.();
  const { master } = ensureGraph(ac);
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ac.currentTime);
  master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 2); // gentle fade-in
  nextNoteTime = ac.currentTime + 0.1;
  timer = setInterval(() => {
    const g = graph;
    if (!g) return;
    while (nextNoteTime < ac.currentTime + LOOKAHEAD_S) {
      scheduleStep(ac, g.master, step, nextNoteTime);
      step += 1;
      nextNoteTime += STEP_SECONDS;
    }
  }, TICK_MS);
}

export function stopMusic(): void {
  const ac = audioCtx();
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (ac && graph) graph.master.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.5);
}

export function setMusic(on: boolean): void {
  if (on) startMusic();
  else stopMusic();
}
