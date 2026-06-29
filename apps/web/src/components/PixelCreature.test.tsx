// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CreatureViewT } from '@amabo/shared';
import { useGame } from '../store/useGame.js';
import { Creature } from './Creature.js';
import { PixelCreature } from './PixelCreature.js';

afterEach(() => {
  cleanup();
  useGame.setState({ pixelMode: false });
});

function creature(over: Partial<CreatureViewT['state']> = {}): CreatureViewT {
  return {
    id: 'c1',
    name: 'Pip',
    graduatedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    state: {
      seed: 3,
      stage: 'bloom',
      disposition: 60,
      ageMinutes: 0,
      stats: { ambra: 80, energy: 80, cleanliness: 100, health: 100, affection: 70, security: 70 },
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
  } as unknown as CreatureViewT;
}

describe('PixelCreature (the opt-in pixel skin)', () => {
  it('renders a crisp-edges grid of rect pixels', () => {
    const { container } = render(<PixelCreature creature={creature()} />);
    const svg = container.querySelector('svg.pixel-creature');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(30);
  });

  it('is deterministic for the same creature', () => {
    const a = render(<PixelCreature creature={creature()} />).container.innerHTML;
    cleanup();
    const b = render(<PixelCreature creature={creature()} />).container.innerHTML;
    expect(a).toBe(b);
  });

  it('marks a Yim distinctly', () => {
    const { container } = render(
      <PixelCreature creature={creature({ uncanny: true, disposition: -60 })} />,
    );
    expect(container.querySelector('svg.is-yim')).toBeTruthy();
  });
});

describe('<Creature> delegates reversibly to the pixel skin', () => {
  it('renders smooth by default, pixel only when the flag is on', () => {
    useGame.setState({ pixelMode: false });
    const smooth = render(<Creature creature={creature()} />);
    expect(smooth.container.querySelector('.pixel-creature')).toBeNull();
    cleanup();

    useGame.setState({ pixelMode: true });
    const pixel = render(<Creature creature={creature()} />);
    expect(pixel.container.querySelector('.pixel-creature')).toBeTruthy();
  });
});
