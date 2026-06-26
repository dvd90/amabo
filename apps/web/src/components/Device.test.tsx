// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Device } from './Device.js';
import { useGame } from '../store/useGame.js';

afterEach(cleanup);

describe('<Device> (M8)', () => {
  it('renders the three physical buttons and an empty Amarium prompt', () => {
    useGame.setState({ creature: null, screen: 'home' });
    render(<Device />);
    expect(screen.getByLabelText('A: next screen')).toBeTruthy();
    expect(screen.getByLabelText('B: confirm')).toBeTruthy();
    expect(screen.getByLabelText('C: back')).toBeTruthy();
    expect(screen.getByText(/A Mote is gathering/i)).toBeTruthy();
  });

  it('reveals a credits card after seven taps on the brand (a hidden egg)', () => {
    useGame.setState({ creature: null, screen: 'home' });
    const { container } = render(<Device />);
    const brand = container.querySelector('.device-brand') as HTMLElement;
    expect(container.querySelector('.credits')).toBeNull();
    for (let i = 0; i < 6; i++) fireEvent.click(brand);
    expect(container.querySelector('.credits')).toBeNull(); // not yet
    fireEvent.click(brand); // the seventh
    expect(container.querySelector('.credits')).toBeTruthy();
  });
});
