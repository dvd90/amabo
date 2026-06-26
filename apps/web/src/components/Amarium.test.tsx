// @vitest-environment jsdom
import type { CreatureViewT } from '@amabo/shared';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Amarium } from './Amarium.js';

afterEach(cleanup);

function view(over: Partial<CreatureViewT['state']> = {}): CreatureViewT {
  return {
    id: 'c1',
    name: 'Pip',
    graduatedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    state: {
      seed: 1,
      stage: 'velveteen',
      disposition: 60,
      ageMinutes: 0,
      stats: { ambra: 80, energy: 80, cleanliness: 100, health: 100, affection: 60, security: 60 },
      asleep: false,
      ill: false,
      uncanny: false,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
      ...over,
    },
  };
}

describe('<Amarium> environment (M-E)', () => {
  it('a radiant Amabo drifts in warm Ambra motes', () => {
    const { container } = render(<Amarium creature={view()} />);
    expect(container.querySelector('.amarium-amabo')).toBeTruthy();
    expect(container.querySelector('.amabo-mote')).toBeTruthy();
    expect(container.querySelector('.amarium-yim')).toBeNull();
  });

  it("a Yim's glass is Satis House — a stopped clock, candle, and raven", () => {
    const { container } = render(<Amarium creature={view({ uncanny: true })} />);
    expect(container.querySelector('.amarium-yim')).toBeTruthy();
    expect(container.querySelector('.yim-clock')).toBeTruthy();
    expect(container.querySelector('.yim-candle')).toBeTruthy();
    expect(container.querySelector('.yim-raven')).toBeTruthy();
  });

  it('an empty glass has no scenery', () => {
    const { container } = render(<Amarium creature={null} />);
    expect(container.querySelector('.amarium-env')).toBeNull();
    expect(container.querySelector('.amarium-scenery')).toBeNull();
  });

  it('gives a living creature a roaming habitat with its own scenery', () => {
    const { container } = render(<Amarium creature={view()} />);
    expect(container.querySelector('.amarium-scenery')).toBeTruthy();
    expect(container.querySelector('.amarium-ground')).toBeTruthy();
    expect(container.querySelector('.amarium-roamer.is-roaming')).toBeTruthy();
    // the procedural scene drew at least a few props
    expect(container.querySelectorAll('.amarium-scenery > g').length).toBeGreaterThan(0);
  });

  it('bursts a flourish when the creature climbs a stage (and a Real shimmer at Bloom)', () => {
    const { container, rerender } = render(<Amarium creature={view({ stage: 'spark' })} />);
    expect(container.querySelector('.amarium-flourish')).toBeNull(); // steady state: none

    rerender(<Amarium creature={view({ stage: 'velveteen' })} />);
    const burst = container.querySelector('.amarium-flourish');
    expect(burst).toBeTruthy();
    expect(burst?.classList.contains('is-real')).toBe(false);

    rerender(<Amarium creature={view({ stage: 'bloom' })} />);
    expect(container.querySelector('.amarium-flourish.is-real')).toBeTruthy();
  });

  it('does not flourish merely from opening a creature already at a stage', () => {
    const { container } = render(<Amarium creature={view({ stage: 'bloom' })} />);
    expect(container.querySelector('.amarium-flourish')).toBeNull();
  });

  it('giggles (a quick wiggle) when you tap an awake, living creature', () => {
    const { container } = render(<Amarium creature={view()} />);
    const sprite = container.querySelector('.amarium-sprite') as HTMLElement;
    expect(container.querySelector('.is-giggling')).toBeNull();
    fireEvent.click(sprite);
    expect(container.querySelector('.is-giggling')).toBeTruthy();
  });

  it('does not giggle while asleep', () => {
    const { container } = render(<Amarium creature={view({ asleep: true })} />);
    fireEvent.click(container.querySelector('.amarium-sprite') as HTMLElement);
    expect(container.querySelector('.is-giggling')).toBeNull();
  });
});
