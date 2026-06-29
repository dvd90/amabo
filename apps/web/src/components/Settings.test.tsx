// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../store/useGame.js';
import { Settings } from './Settings.js';

afterEach(() => {
  cleanup();
  useGame.setState({ theme: 'ember', pixelMode: false });
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
});
