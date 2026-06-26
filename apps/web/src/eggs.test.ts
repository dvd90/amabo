import { describe, expect, it } from 'vitest';
import { nameEgg } from './eggs.js';

describe('nameEgg (canon name eggs, STORY.md §11)', () => {
  it('maps each touchstone name to its egg, case-insensitively', () => {
    expect(nameEgg('Velveteen')).toBe('velveteen');
    expect(nameEgg('skin horse')).toBe('velveteen');
    expect(nameEgg('PINOCCHIO')).toBe('pinocchio');
    expect(nameEgg('Galatea')).toBe('galatea');
    expect(nameEgg('pygmalion')).toBe('galatea');
    expect(nameEgg('Frankenstein')).toBe('frankenstein');
    expect(nameEgg('Nevermore')).toBe('raven');
    expect(nameEgg('Lenore')).toBe('raven');
  });

  it('only matches whole words, so ordinary names stay plain', () => {
    expect(nameEgg('Robin')).toBeNull();
    expect(nameEgg('Frank')).toBeNull();
    expect(nameEgg('Pip')).toBeNull();
    expect(nameEgg('')).toBeNull();
    expect(nameEgg('   ')).toBeNull();
  });

  it('finds the reference even inside a longer name', () => {
    expect(nameEgg('Sir Velveteen the Third')).toBe('velveteen');
    expect(nameEgg('little raven')).toBe('raven');
  });
});
