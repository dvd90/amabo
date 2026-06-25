// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { PublicLook } from './PublicLook.js';

afterEach(cleanup);

function withPostcard(impl: () => Promise<unknown>) {
  useGame.setState({ client: { postcard: vi.fn(impl) } as unknown as ApiClient });
}

describe('<PublicLook> (public keepsake)', () => {
  it('shows the shared creature and an invitation to begin one', async () => {
    withPostcard(async () => ({ name: 'Lumen', stage: 'bloom', uncanny: false, graduated: false }));
    render(<PublicLook token="tok" />);
    await waitFor(() => expect(screen.getByText('Lumen')).toBeTruthy());
    expect(screen.getByText(/radiant Amabo at the bloom stage/i)).toBeTruthy();
    expect(screen.getByText(/Begin your own/i)).toBeTruthy();
  });

  it('handles an expired or missing link gracefully', async () => {
    withPostcard(async () => {
      throw new Error('404');
    });
    render(<PublicLook token="gone" />);
    await waitFor(() => expect(screen.getByText(/expired or moved/i)).toBeTruthy());
  });
});
