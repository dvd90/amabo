// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../store/useGame.js';
import { DuetScene } from './DuetScene.js';

afterEach(() => {
  cleanup();
  useGame.setState({ duet: null });
});

describe('<DuetScene> (a meeting, seen)', () => {
  it('shows nothing until a meeting has resonated', () => {
    useGame.setState({ duet: null });
    const { container } = render(<DuetScene />);
    expect(container.firstChild).toBeNull();
  });

  it('plays a harmony: the thread, the spark, and the sung line', () => {
    useGame.setState({
      duet: { result: 'harmony', a: 'c1', b: 'c2', names: ['Pip', 'Bo'] },
      creatures: [],
    });
    render(<DuetScene />);
    expect(screen.getByText(/Resonance/)).toBeTruthy();
    expect(screen.getByText(/Pip and Bo harmonized/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Leave them to it/ }));
    expect(useGame.getState().duet).toBeNull();
  });

  it('plays a wary clash gently — no one is hurt', () => {
    useGame.setState({
      duet: { result: 'clash', a: 'c1', b: 'c2', names: ['Pip', 'Yearn'] },
      creatures: [],
    });
    render(<DuetScene />);
    expect(screen.getByText(/a little wary/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Give them time/ })).toBeTruthy();
  });
});
