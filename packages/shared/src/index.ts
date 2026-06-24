/**
 * @amabo/shared — zod schemas, shared types, and lore constants.
 *
 * Lore terms are the source of truth (see docs/STORY.md §12 Glossary). Use them
 * exactly: `ambra`, `disposition`, the stages mote→spark→velveteen→bloom, and
 * `elysium`/`stars` for graduation. Mechanics layers (engine, ai, api) import the
 * vocabulary from here so it stays spelled the same everywhere.
 */

/** The life-stage ladder — Plato's ladder of love (STORY.md §5). */
export const STAGES = ['mote', 'spark', 'velveteen', 'bloom'] as const;
export type Stage = (typeof STAGES)[number];

/** Graduated souls leave the glass for Elysium and become named stars (STORY.md §7). */
export const GRADUATED = 'elysium' as const;

/** Disposition runs the Amabo(+) ↔ Yim(−) axis (STORY.md §4). */
export const DISPOSITION_MIN = -100;
export const DISPOSITION_MAX = 100;

/** Mortality modes: `soft` is the gentle default; `classic` allows the light to go out. */
export const MORTALITIES = ['soft', 'classic'] as const;
export type Mortality = (typeof MORTALITIES)[number];

export * from './schemas.js';
