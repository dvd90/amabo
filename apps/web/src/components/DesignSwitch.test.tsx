// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../store/useGame.js';
import { DesignSwitch } from './DesignSwitch.js';

afterEach(() => {
  cleanup();
  useGame.setState({ pixelMode: false });
});

describe('<DesignSwitch>', () => {
  it('reflects and flips the pixel-mode flag', () => {
    useGame.setState({ pixelMode: false });
    render(<DesignSwitch />);
    const smooth = screen.getByRole('button', { name: /Smooth/ });
    const pixel = screen.getByRole('button', { name: /Pixel/ });
    expect(smooth.getAttribute('aria-pressed')).toBe('true');
    expect(pixel.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pixel);
    expect(useGame.getState().pixelMode).toBe(true);
    expect(screen.getByRole('button', { name: /Pixel/ }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /Smooth/ }));
    expect(useGame.getState().pixelMode).toBe(false);
  });

  it('clicking the already-active option is a no-op', () => {
    useGame.setState({ pixelMode: false });
    render(<DesignSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Smooth/ }));
    expect(useGame.getState().pixelMode).toBe(false);
  });
});
