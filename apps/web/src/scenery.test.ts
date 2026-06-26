import { describe, expect, it } from 'vitest';
import { buildScene } from './scenery.js';

describe('buildScene (a deterministic world per creature)', () => {
  it('is deterministic: the same seed yields the same scene', () => {
    expect(buildScene(42, false)).toEqual(buildScene(42, false));
    expect(buildScene(42, true)).toEqual(buildScene(42, true));
  });

  it('different seeds generally produce different layouts', () => {
    const a = JSON.stringify(buildScene(1, false));
    const b = JSON.stringify(buildScene(2, false));
    const c = JSON.stringify(buildScene(3, false));
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it('lays out 4–6 props within the glass bounds, sorted far→near', () => {
    for (const seed of [1, 7, 19, 100, 5000]) {
      const scene = buildScene(seed, false);
      expect(scene.length).toBeGreaterThanOrEqual(4);
      expect(scene.length).toBeLessThanOrEqual(6);
      for (const p of scene) {
        expect(p.x).toBeGreaterThanOrEqual(4);
        expect(p.x).toBeLessThanOrEqual(96);
        expect(p.depth).toBeGreaterThanOrEqual(0);
        expect(p.depth).toBeLessThanOrEqual(1);
      }
      const depths = scene.map((p) => p.depth);
      expect([...depths].sort((a, b) => a - b)).toEqual(depths);
    }
  });

  it('draws warm props for an Amabo and eerie props for a Yim', () => {
    const amabo = new Set(buildScene(11, false).map((p) => p.kind));
    const yim = new Set(buildScene(11, true).map((p) => p.kind));
    const amaboSet = new Set(['leafy', 'pine', 'house', 'bush', 'rock', 'flower']);
    const yimSet = new Set(['deadtree', 'ruin', 'grave', 'deadbush', 'rock']);
    for (const k of amabo) expect(amaboSet.has(k)).toBe(true);
    for (const k of yim) expect(yimSet.has(k)).toBe(true);
  });
});
