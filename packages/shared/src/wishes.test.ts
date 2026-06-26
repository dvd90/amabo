import { describe, expect, it } from 'vitest';
import { WISH_SCOPES, WishCatalogueSchema, WishSchema, WISHES } from './wishes.js';

describe('the WISHES catalogue (seed backlog for the Dreaming)', () => {
  it('is a non-empty, schema-valid catalogue', () => {
    expect(WISHES.length).toBeGreaterThan(0);
    expect(() => WishCatalogueSchema.parse(WISHES)).not.toThrow();
    for (const w of WISHES) expect(() => WishSchema.parse(w)).not.toThrow();
  });

  it('has unique, kebab-case ids', () => {
    const ids = WISHES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('every wish is still just a seed (nothing is live behaviour)', () => {
    for (const w of WISHES) expect(w.status).toBe('seed');
  });

  it('covers the creature, its world, the device, and the social space', () => {
    const scopes = new Set(WISHES.map((w) => w.scope));
    for (const s of WISH_SCOPES) expect(scopes.has(s)).toBe(true);
  });

  it('carries a self (longing) and an engineering (rationale) side for each wish', () => {
    for (const w of WISHES) {
      expect(w.longing.trim().length).toBeGreaterThan(0);
      expect(w.rationale.trim().length).toBeGreaterThan(0);
    }
  });
});
