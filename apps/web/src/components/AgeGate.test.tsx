// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/client.js';
import { useGame } from '../store/useGame.js';
import { AgeGate } from './AgeGate.js';

afterEach(() => {
  cleanup();
  useGame.setState({ ageBand: null });
});

describe('<AgeGate> (L2) — the one honest question', () => {
  it('states a band and the store remembers it', async () => {
    const setAge = vi.fn().mockResolvedValue(undefined);
    useGame.setState({ client: { setAge } as unknown as ApiClient, ageBand: null });
    render(<AgeGate />);
    fireEvent.click(screen.getByRole('button', { name: /13–17/ }));
    await Promise.resolve();
    expect(setAge).toHaveBeenCalledWith('13-17');
    expect(useGame.getState().ageBand).toBe('13-17');
  });

  it('under-13 is refused kindly — no band is ever stored', () => {
    const setAge = vi.fn();
    useGame.setState({ client: { setAge } as unknown as ApiClient, ageBand: null });
    render(<AgeGate />);
    fireEvent.click(screen.getByRole('button', { name: /under 13/ }));
    expect(screen.getByText(/glass stays closed/)).toBeTruthy();
    expect(setAge).not.toHaveBeenCalled();
  });
});
