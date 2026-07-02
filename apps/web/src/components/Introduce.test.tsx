// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RosterItem } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Introduce } from './Introduce.js';

function member(id: string, name: string, disposition: number, uncanny = false): RosterItem {
  return {
    id,
    name,
    graduatedAt: null,
    archivedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    needs: [],
    state: {
      seed: 1,
      stage: 'spark',
      disposition,
      ageMinutes: 0,
      stats: { ambra: 70, energy: 80, cleanliness: 100, health: 100, affection: 50, security: 50 },
      asleep: false,
      ill: false,
      uncanny,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
    },
  };
}

afterEach(() => {
  cleanup();
});

describe('<Introduce> (the picker ceremony, M-I)', () => {
  it('reads a close pair truthfully: they will harmonize — and who may be drawn back', async () => {
    useGame.setState({
      creatures: [member('c1', 'Pip', 10), member('c2', 'Moth', -20), member('c3', 'Yearn', -80)],
    });
    render(<Introduce onClose={() => {}} onDone={() => {}} />);

    // Until two are chosen, there is no reading and no way to proceed.
    expect(screen.queryByText(/hums alike|far apart/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Choose Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choose Moth/ }));

    // gap 30 ≤ harmonyGap: a truthful, hopeful reading…
    expect(screen.getByText(/hums alike/)).toBeTruthy();
    // …that teaches the strategy: the souring one may be drawn back.
    expect(screen.getByText(/Moth may drift back toward the light/)).toBeTruthy();
  });

  it('reads a far pair honestly: a wary meeting, no harm done', () => {
    useGame.setState({
      creatures: [member('c1', 'Pip', 10), member('c3', 'Yearn', -80, true)],
    });
    render(<Introduce onClose={() => {}} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Choose Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choose Yearn/ }));
    expect(screen.getByText(/far apart/)).toBeTruthy();
  });

  it('lets them meet: calls the meeting, reports the line, and closes', async () => {
    const meet = vi.fn().mockResolvedValue('Pip and Moth harmonized ✦');
    const onClose = vi.fn();
    const onDone = vi.fn();
    useGame.setState({
      creatures: [member('c1', 'Pip', 10), member('c2', 'Moth', -20)],
      meet,
    });
    render(<Introduce onClose={onClose} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /Choose Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choose Moth/ }));
    fireEvent.click(screen.getByRole('button', { name: /Let them meet/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(meet).toHaveBeenCalledWith('c1', 'c2');
    expect(onDone).toHaveBeenCalledWith('Pip and Moth harmonized ✦');
  });

  it('a chosen one can be unchosen, and only living, present lights are offered', () => {
    const gone = { ...member('c9', 'Elder', 50), graduatedAt: 123 };
    useGame.setState({
      creatures: [member('c1', 'Pip', 10), member('c2', 'Moth', -20), gone],
    });
    render(<Introduce onClose={() => {}} onDone={() => {}} />);
    expect(screen.queryByRole('button', { name: /Choose Elder/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Choose Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choose Pip/ })); // unchoose
    fireEvent.click(screen.getByRole('button', { name: /Choose Moth/ }));
    // Only one is chosen now — still no reading.
    expect(screen.queryByText(/hums alike|far apart/)).toBeNull();
  });
});
