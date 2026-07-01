// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Ambient } from './Ambient.js';

afterEach(cleanup);

describe('<Ambient> (the living air)', () => {
  it('renders a deterministic field of motes plus vignette and grain', () => {
    const { container } = render(<Ambient />);
    expect(container.querySelectorAll('.ambient-mote').length).toBe(26);
    expect(container.querySelector('.ambient-vignette')).toBeTruthy();
    expect(container.querySelector('.ambient-grain')).toBeTruthy();
    // decorative only — hidden from the accessibility tree, never interactive
    expect(container.querySelector('.ambient')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('is stable across renders (no random layout)', () => {
    const a = render(<Ambient />).container.innerHTML;
    cleanup();
    const b = render(<Ambient />).container.innerHTML;
    expect(a).toBe(b);
  });
});
