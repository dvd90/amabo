// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardFilename, cardPalette, shareOrSaveCard, wrapLines } from './shareCard.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shareCard helpers', () => {
  it('wraps text greedily to fit a max width (pure, measured by the injection)', () => {
    // measure = character count; max 10 chars per line
    const lines = wrapLines('the day went soft and gold', 10, (s) => s.length);
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(lines.join(' ')).toBe('the day went soft and gold');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('keeps a word that is itself longer than the line on its own line', () => {
    const lines = wrapLines('a supercalifragilistic word', 8, (s) => s.length);
    expect(lines).toContain('supercalifragilistic');
  });

  it('makes a safe, format-specific filename', () => {
    expect(cardFilename('Pip', 'story')).toBe('pip-story.png');
    expect(cardFilename('Yim of the Glass!', 'square')).toBe('yim-of-the-glass-square.png');
    expect(cardFilename('✦✦✦', 'story')).toBe('amabo-story.png');
  });

  it('gives the two souls distinct palettes', () => {
    expect(cardPalette(false).glow).not.toBe(cardPalette(true).glow);
  });

  it('shares via the Web Share API when files are supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const where = await shareOrSaveCard(new Blob(['x']), 'pip-story.png', 'Pip');
    expect(where).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('falls back to a download when sharing files is unavailable', async () => {
    vi.stubGlobal('navigator', {}); // no share/canShare
    const click = vi.fn();
    const a = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(a);
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => {},
    } as unknown as typeof URL);
    const where = await shareOrSaveCard(new Blob(['x']), 'pip-square.png', 'Pip');
    expect(where).toBe('saved');
    expect(a.download).toBe('pip-square.png');
    expect(click).toHaveBeenCalledOnce();
  });
});
