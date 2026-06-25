// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Graduation } from './Graduation.js';

afterEach(cleanup);

const star = {
  id: 's1',
  name: 'Lumen',
  bornAt: 0,
  graduatedAt: 3 * 86_400_000,
  constellationPos: { x: 0.1, y: 0.2 },
};

describe('<Graduation> (into the West)', () => {
  it('shows nothing until a creature ascends', () => {
    useGame.setState({ graduation: null });
    const { container } = render(<Graduation />);
    expect(container.firstChild).toBeNull();
  });

  it('names the new star and how long it shone', () => {
    useGame.setState({ graduation: star });
    render(<Graduation />);
    expect(screen.getByText(/Into the West/i)).toBeTruthy();
    expect(screen.getByText('Lumen')).toBeTruthy();
    expect(screen.getByText(/3 days/i)).toBeTruthy();
  });

  it('dismisses to the roster', async () => {
    const client = { listCreatures: vi.fn().mockResolvedValue([]) } as unknown as ApiClient;
    useGame.setState({ graduation: star, client });
    render(<Graduation />);
    fireEvent.click(screen.getByText(/Look to the sky/i));
    expect(useGame.getState().graduation).toBeNull();
  });
});
