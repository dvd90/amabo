/**
 * @amabo/ai — narration (docs/ARCHITECTURE.md §5).
 *
 * LAW 2: this package owns ONLY flavor. It turns engine state into the creature's
 * voice per STORY.md §9, is data-in / text-out, and never mutates game state nor is
 * trusted. The Anthropic client is injected so it stays the single, isolated LLM caller.
 */

export * from './models.js';
export * from './schema.js';
export * from './voice.js';
export * from './narrate.js';
export * from './client.js';
