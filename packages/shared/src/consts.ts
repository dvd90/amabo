/**
 * consts.ts — lore constants & types (STORY.md §12 Glossary). Kept in their own module
 * (no imports) so schemas.ts and index.ts can both depend on them without a circular
 * import — which otherwise causes an ESM temporal-dead-zone error at runtime.
 *
 * Use the lore terms exactly: `ambra`, `disposition`, the stages
 * mote→spark→velveteen→bloom, and `elysium`/`stars` for graduation.
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

/**
 * Resonance (STORY.md §7¾): two temperaments within this disposition gap harmonize
 * when they meet; farther apart, the meeting is wary. Shared so the device can read
 * a pair truthfully *before* the meeting — the rule itself lives in the engine.
 */
export const HARMONY_GAP = 40;

/**
 * The shelf (LAUNCH_PLAN.md L4/L5): how many ACTIVE lights an account may tend at
 * once — alive, unascended, unarchived. Free Lights keep three; the Keeper's Lantern
 * widens the shelf. Endings never count: the shelf is capacity, never a gate on the
 * soul (souring/illness/death/redemption are untouchable by the till).
 */
export const SLOTS = { free: 3, lantern: 8 } as const;
