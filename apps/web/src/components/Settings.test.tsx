// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { Settings } from './Settings.js';

afterEach(() => {
  cleanup();
  useGame.setState({ theme: 'ember', pixelMode: false, authed: null });
});

describe('<Settings>', () => {
  it('lists the themes and applies the one you pick', () => {
    useGame.setState({ theme: 'ember' });
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Aqua/ }));
    expect(useGame.getState().theme).toBe('aqua');
    expect(screen.getByRole('button', { name: /Aqua/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('includes the art-style switch', () => {
    render(<Settings onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Pixel/ })).toBeTruthy();
  });

  it('closes on the ✕', () => {
    const onClose = vi.fn();
    render(<Settings onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('offers the small print and a guarded goodbye (L2)', async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    useGame.setState({ client: { deleteAccount } as unknown as ApiClient });
    render(<Settings onClose={() => {}} />);
    expect(screen.getByText('Terms')).toBeTruthy();
    expect(screen.getByText('Privacy')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Delete my account/ }));
    const go = screen.getByRole('button', { name: /Let it all go/ });
    expect((go as HTMLButtonElement).disabled).toBe(true); // nothing typed yet
    fireEvent.change(screen.getByLabelText(/confirm deletion/), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(go);
    await Promise.resolve();
    expect(deleteAccount).toHaveBeenCalledWith('me@example.com');
  });

  it('names the build it runs (deploy truth, L0)', () => {
    render(<Settings onClose={() => {}} />);
    expect(screen.getByText(/^build /)).toBeTruthy();
  });

  it('saves a picked theme to the account when signed in, beside the local cache', () => {
    const updatePreferences = vi.fn().mockResolvedValue({});
    useGame.setState({
      theme: 'ember',
      authed: true,
      client: { updatePreferences } as unknown as ApiClient,
    });
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Grape/ }));
    expect(updatePreferences).toHaveBeenCalledWith({ theme: 'grape' });
    expect(localStorage.getItem('amabo:theme')).toBe('grape');
  });

  it('does not call the server while signed out — local-only', () => {
    const updatePreferences = vi.fn();
    useGame.setState({
      theme: 'ember',
      authed: false,
      client: { updatePreferences } as unknown as ApiClient,
    });
    render(<Settings onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Grape/ }));
    expect(updatePreferences).not.toHaveBeenCalled();
  });
});
