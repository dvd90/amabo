// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryPage } from './StoryPage.js';

afterEach(cleanup);

describe('<StoryPage> (the Codex)', () => {
  it('renders the myth sections with both fates illustrated', () => {
    const { container } = render(<StoryPage onClose={() => {}} />);
    expect(screen.getByText(/Ambra — love that has to go somewhere/i)).toBeTruthy();
    expect(screen.getByText(/Amabo — love that landed/i)).toBeTruthy();
    expect(screen.getByText(/Yim — love gone unspent/i)).toBeTruthy();
    // Inline SVG creatures illustrate the two fates.
    expect(container.querySelectorAll('svg.creature').length).toBeGreaterThanOrEqual(2);
  });

  it('closes on the close button', () => {
    const onClose = vi.fn();
    render(<StoryPage onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close the story'));
    expect(onClose).toHaveBeenCalled();
  });
});
