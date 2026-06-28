// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, CreatureViewT } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Welcome } from './Welcome.js';

afterEach(cleanup);

const demoCreature = (): CreatureViewT =>
  ({
    id: 'demo',
    name: 'Mote',
    graduatedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    state: {
      seed: 7,
      stage: 'mote',
      disposition: 0,
      ageMinutes: 0,
      stats: { ambra: 80, energy: 80, cleanliness: 100, health: 100, affection: 50, security: 50 },
      asleep: false,
      ill: false,
      uncanny: false,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
    },
  }) as unknown as CreatureViewT;

describe('<Welcome> (the birth moment)', () => {
  it('meets a newborn Mote, shows its first thought, and stashes its seed', async () => {
    const demoBirth = vi.fn().mockResolvedValue({
      creature: demoCreature(),
      needs: [],
      thought: 'First there was warm, and then there was me.',
      seed: 7,
    });
    useGame.setState({ client: { demoBirth } as unknown as ApiClient, authView: 'welcome' });

    render(<Welcome />);
    await waitFor(() => expect(screen.getByText(/First there was warm/)).toBeTruthy());
    expect(demoBirth).toHaveBeenCalled();
    // the seed was remembered so signup keeps this very creature
    expect(localStorage.getItem('amabo:demoSeed')).toBe('7');
  });

  it('the keep-this-light CTA leads to sign-in', async () => {
    useGame.setState({
      client: {
        demoBirth: vi
          .fn()
          .mockResolvedValue({ creature: demoCreature(), needs: [], thought: 'hi', seed: 1 }),
      } as unknown as ApiClient,
      authView: 'welcome',
    });
    render(<Welcome />);
    fireEvent.click(screen.getByRole('button', { name: /Keep this/ }));
    expect(useGame.getState().authView).toBe('login');
  });
});
