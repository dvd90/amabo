/**
 * @amabo/shared — zod schemas, shared types, and lore constants.
 *
 * The lore vocabulary lives in `consts.ts` and the boundary schemas in `schemas.ts`;
 * both are re-exported here. Keeping the constants in their own (import-free) module
 * avoids a circular import between this barrel and the schemas.
 */

export * from './consts.js';
export * from './schemas.js';
