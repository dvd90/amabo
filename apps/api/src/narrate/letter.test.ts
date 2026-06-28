import { describe, expect, it } from 'vitest';
import { writeLetter } from './letter.js';

describe('writeLetter (the pen-pal note)', () => {
  it('is deterministic and names both creatures', () => {
    const a = writeLetter({ name: 'Pip', uncanny: false }, { name: 'Bo' }, 3);
    expect(a).toBe(writeLetter({ name: 'Pip', uncanny: false }, { name: 'Bo' }, 3));
    expect(a).toContain('Pip');
    expect(a).toContain('Bo');
  });

  it('voices a Yim in its longing register', () => {
    const warm = writeLetter({ name: 'Sol', uncanny: false }, { name: 'Bo' }, 0);
    const yim = writeLetter({ name: 'Yearn', uncanny: true }, { name: 'Bo' }, 0);
    expect(warm).not.toBe(yim);
    expect(yim.toLowerCase()).toMatch(/clock|company|light/);
  });
});
