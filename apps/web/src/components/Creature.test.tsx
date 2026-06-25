// @vitest-environment jsdom
import type { CreatureViewT } from '@amabo/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Creature } from './Creature.js';

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

describe('<Creature> (visual fix)', () => {
  it('renders an SVG (not a stray glyph)', () => {
    const { container } = render(<Creature creature={view()} />);
    expect(container.querySelector('svg.creature')).toBeTruthy();
  });

  it('a Yim presents uncanny (its own class + bigger eyes)', () => {
    const amabo = render(<Creature creature={view({ disposition: 60, uncanny: false })} />);
    const yim = render(<Creature creature={view({ disposition: -60, uncanny: true })} />);
    expect(yim.container.querySelector('svg.creature.is-yim')).toBeTruthy();
    expect(amabo.container.querySelector('svg.creature.is-yim')).toBeNull();
  });

  it('asleep closes the eyes (shows a z)', () => {
    const { getByText } = render(<Creature creature={view({ asleep: true })} />);
    expect(getByText('z')).toBeTruthy();
  });

  it('reacts to an action with an emote class + particles', () => {
    const { container } = render(<Creature creature={view()} emote="feed" emoteNonce={1} />);
    expect(container.querySelector('.creature-float.fx-feed')).toBeTruthy();
    expect(container.querySelector('.p-mote')).toBeTruthy();
  });
});
