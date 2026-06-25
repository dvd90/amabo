// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Login } from './Login.js';

afterEach(cleanup);

function withClient(google: boolean) {
  const client = {
    authConfig: vi.fn().mockResolvedValue({ email: true, google }),
  } as unknown as ApiClient;
  useGame.setState({ client });
  return client;
}

describe('<Login> (the threshold)', () => {
  it('always offers email; shows Google only when the server enables it', async () => {
    withClient(true);
    render(<Login />);
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Continue with Google/i)).toBeTruthy());
  });

  it('hides the Google button when it is not configured', async () => {
    const client = withClient(false);
    render(<Login />);
    await waitFor(() => expect(client.authConfig).toHaveBeenCalled());
    expect(screen.queryByText(/Continue with Google/i)).toBeNull();
  });

  it('offers the explainer video, opening it in a modal', () => {
    withClient(false);
    const { container } = render(<Login />);
    expect(container.querySelector('video')).toBeNull(); // closed by default
    fireEvent.click(screen.getByText(/Watch how it works/i));
    expect(container.querySelector('video')).toBeTruthy();
    expect(container.querySelector('source')?.getAttribute('src')).toBe('/amabo-explainer.webm');
  });

  it('surfaces an OAuth failure flagged in the URL', async () => {
    window.history.replaceState({}, '', '/?auth_error=google');
    withClient(false);
    render(<Login />);
    expect(screen.getByRole('alert').textContent).toMatch(/Google sign-in failed/i);
    // …and the flag is cleaned out of the URL so a refresh won't re-show it.
    expect(window.location.search).toBe('');
  });
});
