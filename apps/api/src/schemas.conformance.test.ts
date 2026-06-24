/**
 * The shared zod schemas must stay structurally identical to the engine's domain
 * types — otherwise a boundary could validate something the engine can't use. These
 * assignments are checked at compile time; if the two ever drift, typecheck fails.
 */

import type { CreatureState, SimEvent, Star } from '@amabo/engine';
import { CreatureStateSchema, SimEventSchema, StarSchema } from '@amabo/shared';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

type SchemaState = z.infer<typeof CreatureStateSchema>;
type SchemaStar = z.infer<typeof StarSchema>;

// Two-way assignability (compile-time conformance).
const _stateToSchema = (s: CreatureState): SchemaState => s;
const _schemaToState = (s: SchemaState): CreatureState => s;
const _starToSchema = (s: Star): SchemaStar => s;
const _schemaToStar = (s: SchemaStar): Star => s;

describe('schema conformance (M5)', () => {
  it('a real engine event validates against the shared schema', () => {
    const e: SimEvent = {
      at: 1,
      kind: 'fed',
      statDeltas: { ambra: 1 },
      dispositionDelta: 0,
      salience: 2,
    };
    expect(SimEventSchema.safeParse(e).success).toBe(true);
  });

  it('keeps the type bridges referenced', () => {
    expect([_stateToSchema, _schemaToState, _starToSchema, _schemaToStar]).toHaveLength(4);
  });
});
