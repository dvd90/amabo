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
    archivedAt: null,
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

  it('is polymorphic by stage: a Mote is bare; an antenna grows by Spark', () => {
    const mote = render(<Creature creature={view({ stage: 'mote' })} />);
    const spark = render(<Creature creature={view({ stage: 'spark' })} />);
    expect(mote.container.querySelector('.creature-antenna')).toBeNull();
    expect(spark.container.querySelector('.creature-antenna')).toBeTruthy();
  });

  it('grows soft ears by the Velveteen stage', () => {
    const spark = render(<Creature creature={view({ stage: 'spark' })} />);
    const velveteen = render(<Creature creature={view({ stage: 'velveteen' })} />);
    expect(spark.container.querySelector('.creature-ear')).toBeNull();
    expect(velveteen.container.querySelector('.creature-ear')).toBeTruthy();
  });

  it('the stage is exposed for styling/inspection', () => {
    const { container } = render(<Creature creature={view({ stage: 'bloom' })} />);
    expect(container.querySelector('svg.creature')?.getAttribute('data-stage')).toBe('bloom');
  });

  it('open eyes blink and have a gaze group that can track the Light', () => {
    const { container } = render(<Creature creature={view()} />);
    expect(container.querySelector('.creature-eyes')).toBeTruthy();
    expect(container.querySelector('.creature-gaze')).toBeTruthy();
    // a per-creature blink offset keeps a row of them from blinking in unison
    expect(
      (container.querySelector('.creature-eyes') as SVGElement).style.animationDelay,
    ).toBeTruthy();
  });

  it('asleep has no blinking eyes group (they are closed)', () => {
    const { container } = render(<Creature creature={view({ asleep: true })} />);
    expect(container.querySelector('.creature-eyes')).toBeNull();
  });

  it('marks a creature named after a touchstone (and leaves ordinary names plain)', () => {
    const velveteen = render(<Creature creature={{ ...view(), name: 'Velveteen' }} />);
    const plain = render(<Creature creature={{ ...view(), name: 'Pip' }} />);
    expect(velveteen.container.querySelector('.egg-velveteen')).toBeTruthy();
    expect(plain.container.querySelector('[class^="egg-"]')).toBeNull();
  });

  it('a rare seed is born an iridescent Mote (and only at the Mote stage)', () => {
    const rareMote = render(<Creature creature={view({ stage: 'mote', seed: 28 })} />);
    const plainMote = render(<Creature creature={view({ stage: 'mote', seed: 1 })} />);
    const rareGrown = render(<Creature creature={view({ stage: 'bloom', seed: 28 })} />);
    expect(rareMote.container.querySelector('.creature.is-iridescent')).toBeTruthy();
    expect(plainMote.container.querySelector('.creature.is-iridescent')).toBeNull();
    expect(rareGrown.container.querySelector('.creature.is-iridescent')).toBeNull();
  });

  it('droops when tired (low energy) and dims when its Ambra runs low', () => {
    const tired = render(
      <Creature creature={view({ stats: { ...view().state.stats, energy: 10 } })} />,
    );
    const dim = render(
      <Creature creature={view({ stats: { ...view().state.stats, ambra: 12 } })} />,
    );
    const bright = render(<Creature creature={view()} />);
    expect(tired.container.querySelector('svg.creature.is-tired')).toBeTruthy();
    expect(dim.container.querySelector('svg.creature.is-dim')).toBeTruthy();
    expect(bright.container.querySelector('svg.creature.is-tired')).toBeNull();
    expect(bright.container.querySelector('svg.creature.is-dim')).toBeNull();
  });
});
