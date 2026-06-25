// @vitest-environment jsdom
import type { CreatureViewT } from '@amabo/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GapSummary } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { AwayRecap } from './AwayRecap.js';

afterEach(cleanup);

const creature = { id: 'c1', name: 'Pip' } as CreatureViewT;

function show(reveal: GapSummary | null, journal: string | null = null) {
  useGame.setState({ reveal, creature, lastJournal: journal, mood: 'content' });
}

describe('<AwayRecap> (the magic beat)', () => {
  it('reveals elapsed time, the highlights, and the journal line', () => {
    show(
      {
        elapsedMinutes: 360,
        fromStage: 'mote',
        toStage: 'spark',
        highlights: ['grew', 'hungry'],
        deltas: { ambra: -20 },
      },
      'The glass went dark early. I waited by the warm spot.',
    );
    render(<AwayRecap />);
    expect(screen.getByText(/While you were away/i)).toBeTruthy();
    expect(screen.getByText(/6 hours in the dark/i)).toBeTruthy();
    expect(screen.getByText(/grew into a new shape/i)).toBeTruthy();
    expect(screen.getByText(/Ambra run low/i)).toBeTruthy();
    expect(screen.getByText(/waited by the warm spot/i)).toBeTruthy();
  });

  it('dismisses on the button', () => {
    show({
      elapsedMinutes: 120,
      fromStage: 'mote',
      toStage: 'mote',
      highlights: ['content'],
      deltas: {},
    });
    render(<AwayRecap />);
    fireEvent.click(screen.getByText(/Look in on Pip/i));
    expect(useGame.getState().reveal).toBeNull();
  });

  it('shows nothing for a trivial gap (just looked, nothing changed)', () => {
    show({ elapsedMinutes: 3, fromStage: 'mote', toStage: 'mote', highlights: [], deltas: {} });
    const { container } = render(<AwayRecap />);
    expect(container.firstChild).toBeNull();
  });
});
