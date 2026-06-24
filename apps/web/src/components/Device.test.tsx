// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Device } from './Device.js';
import { useGame } from '../store/useGame.js';

describe('<Device> (M8)', () => {
  it('renders the three physical buttons and an empty Amarium prompt', () => {
    useGame.setState({ creature: null, screen: 'home' });
    render(<Device />);
    expect(screen.getByLabelText('A: next screen')).toBeTruthy();
    expect(screen.getByLabelText('B: confirm')).toBeTruthy();
    expect(screen.getByLabelText('C: back')).toBeTruthy();
    expect(screen.getByText(/A Mote is gathering/i)).toBeTruthy();
  });
});
