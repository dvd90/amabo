// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient, RosterItem } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Farewell } from './Farewell.js';

afterEach(cleanup);

function ended(over: Partial<RosterItem> = {}): RosterItem {
  return {
    id: 'c1',
    name: 'Lumen',
    graduatedAt: 100,
    archivedAt: null,
    lastSeenAt: null,
    createdAt: 0,
    needs: [],
    state: {
      seed: 1,
      stage: 'bloom',
      disposition: 80,
      ageMinutes: 0,
      stats: { ambra: 90, energy: 80, cleanliness: 100, health: 100, affection: 90, security: 90 },
      asleep: false,
      ill: false,
      uncanny: false,
      alive: true,
      mortality: 'soft',
      traits: {},
      careHistory: { fed: 0, cleaned: 0, played: 0, comforted: 0, neglectedSteps: 0 },
      lastTickAt: 0,
    },
    ...over,
  } as RosterItem;
}

describe('<Farewell> (endings leave the shelf)', () => {
  it('an ascended light is laid to rest warmly — Mnemosyne', async () => {
    const archive = vi.fn().mockResolvedValue(undefined);
    const listCreatures = vi.fn().mockResolvedValue([]);
    const incomingRehomes = vi.fn().mockResolvedValue([]);
    useGame.setState({
      client: { archive, listCreatures, incomingRehomes } as unknown as ApiClient,
    });
    const onClose = vi.fn();
    render(<Farewell creature={ended()} onClose={onClose} />);

    expect(screen.getByText(/Mnemosyne/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Lay it to rest/ }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith('c1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('a faded light is let go quietly — Lethe', () => {
    render(
      <Farewell
        creature={ended({ graduatedAt: null, state: { ...ended().state, alive: false } })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Lethe/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Let it go/ })).toBeTruthy();
  });

  it('"not yet" closes without archiving', () => {
    const archive = vi.fn();
    useGame.setState({ client: { archive } as unknown as ApiClient });
    const onClose = vi.fn();
    render(<Farewell creature={ended()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /not yet/ }));
    expect(onClose).toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
  });
});
