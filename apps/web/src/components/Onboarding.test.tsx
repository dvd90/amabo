// @vitest-environment jsdom
import type { CreatureViewT } from '@amabo/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Onboarding } from './Onboarding.js';

function fakeClient(): ApiClient {
  const creature = { id: 'c1', name: 'Bel', graduatedAt: null, createdAt: 0 } as CreatureViewT;
  return {
    me: vi.fn(),
    createCreature: vi.fn().mockResolvedValue(creature),
    getCreature: vi.fn(),
    peek: vi.fn(),
    interact: vi.fn(),
    journal: vi.fn(),
    stars: vi.fn(),
    boot: vi.fn(),
  } as unknown as ApiClient;
}

describe('<Onboarding> (story + naming)', () => {
  it('walks the myth, then condenses a named Mote', async () => {
    const client = fakeClient();
    useGame.setState({ client, creature: null });

    render(<Onboarding />);
    expect(screen.getByText(/Love has to go somewhere/i)).toBeTruthy();

    // Advance through the four beats to the naming step.
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Begin'));

    const input = screen.getByLabelText('Creature name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Bel' } });
    fireEvent.click(screen.getByText(/Condense the light/i));

    expect(client.createCreature).toHaveBeenCalledWith('Bel', undefined);
  });
});
