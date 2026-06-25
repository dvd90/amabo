// @vitest-environment jsdom
import type { CreatureViewT } from '@amabo/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../store/useGame.js';
import { Dashboard } from './Dashboard.js';

afterEach(cleanup);

function creature(id: string, name: string, over: Partial<CreatureViewT['state']> = {}) {
  return {
    id,
    name,
    graduatedAt: null,
    createdAt: 0,
    state: {
      seed: 1,
      stage: 'mote',
      disposition: 0,
      ageMinutes: 0,
      stats: { ambra: 70, energy: 80, cleanliness: 100, health: 100, affection: 50, security: 50 },
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
  } as CreatureViewT;
}

describe('<Dashboard> (the roster)', () => {
  it('shows every amabo and opens one on click', () => {
    const openCreature = vi.fn().mockResolvedValue(undefined);
    useGame.setState({
      creatures: [creature('c1', 'Pip'), creature('c2', 'Bo', { uncanny: true })],
      openCreature,
    });
    render(<Dashboard />);
    expect(screen.getByText('Pip')).toBeTruthy();
    expect(screen.getByText('Bo')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Open Pip'));
    expect(openCreature).toHaveBeenCalledWith('c1');
  });

  it('reveals a naming field to condense a new Mote', () => {
    const start = vi.fn().mockResolvedValue(undefined);
    useGame.setState({ creatures: [creature('c1', 'Pip')], start });
    render(<Dashboard />);

    fireEvent.click(screen.getByLabelText('Condense a new Mote'));
    const input = screen.getByLabelText('New creature name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Vel' } });
    fireEvent.submit(input.closest('form')!);
    expect(start).toHaveBeenCalledWith('Vel');
  });
});
