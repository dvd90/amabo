// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreatureViewT } from '@amabo/shared';
import type { ApiClient, GatheringView, RosterItem } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Glade } from './Glade.js';

afterEach(cleanup);

function creature(id: string, name: string): RosterItem {
  return {
    id,
    name,
    graduatedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    needs: [],
    state: {
      seed: 1,
      stage: 'bloom',
      disposition: 40,
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
    },
  } as RosterItem & { state: CreatureViewT['state'] };
}

const gatheringView = (): GatheringView => ({
  id: 'g1',
  at: 0,
  participants: [
    { id: 'c1', name: 'Pip', stage: 'bloom', uncanny: false },
    { id: 'c2', name: 'Bo', stage: 'bloom', uncanny: false },
  ],
  connections: [{ a: 'c1', b: 'c2', kind: 'harmony' }],
  moments: [],
  outcomes: [
    { id: 'c1', warmed: false, comfortedById: null, bondedWith: ['c2'] },
    { id: 'c2', warmed: false, comfortedById: null, bondedWith: ['c1'] },
  ],
  transcript: [
    { speaker: '', text: 'The glade filled with light.' },
    { speaker: 'Pip', text: 'Love is attention that found somewhere to land.' },
  ],
});

describe('<Glade> (the Symposium)', () => {
  it('lets you pick creatures and hold a gathering, then reads the conversation', async () => {
    const gather = vi.fn().mockResolvedValue(gatheringView());
    const client = {
      gather,
      letters: vi.fn().mockResolvedValue([]),
      listCreatures: vi.fn().mockResolvedValue([creature('c1', 'Pip'), creature('c2', 'Bo')]),
      incomingRehomes: vi.fn().mockResolvedValue([]),
    } as unknown as ApiClient;
    useGame.setState({
      client,
      creatures: [creature('c1', 'Pip'), creature('c2', 'Bo')],
      gathering: null,
      route: 'glade',
    });

    render(<Glade />);
    // pick two
    fireEvent.click(screen.getByRole('button', { name: /Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gather/ }));

    await waitFor(() => expect(gather).toHaveBeenCalledWith(['c1', 'c2'], undefined, []));
    // the held gathering plays as a scene; skip to its summary
    await waitFor(() => expect(screen.getByText(/Skip/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Skip/));
    // the conversation + an outcome are shown in the summary
    expect(screen.getByText(/attention that found somewhere to land/)).toBeTruthy();
    expect(screen.getByText(/became closer/)).toBeTruthy();
  });

  it('needs at least two before it will gather', () => {
    useGame.setState({
      creatures: [creature('c1', 'Pip'), creature('c2', 'Bo')],
      gathering: null,
      route: 'glade',
    });
    render(<Glade />);
    const btn = screen.getByRole('button', { name: /Gather/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Pip/ }));
    expect(btn.disabled).toBe(true); // only one picked
    fireEvent.click(screen.getByRole('button', { name: /Bo/ }));
    expect(btn.disabled).toBe(false);
  });
});
