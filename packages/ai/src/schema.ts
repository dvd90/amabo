/**
 * schema.ts — the structured-output contract. The `record_life` tool's input schema
 * IS NarrateOutput, so the model returns validated JSON we never parse from prose
 * (ARCHITECTURE.md §5). Schema-invalid output falls back to a local line.
 */

import { z } from 'zod';

export const NarrateOutputSchema = z.object({
  journal: z.string().min(1).max(400),
  mood: z.string().min(1).max(40),
  newMemories: z.array(z.object({ text: z.string().min(1), salience: z.number() })).optional(),
});

export type NarrateOutput = z.infer<typeof NarrateOutputSchema>;

/** JSON Schema for the record_life tool input (mirrors NarrateOutputSchema). */
export const RECORD_LIFE_TOOL = {
  name: 'record_life',
  description: "Record the creature's diary entry for this moment.",
  input_schema: {
    type: 'object',
    properties: {
      journal: { type: 'string', description: 'One to three short first-person sentences.' },
      mood: { type: 'string', description: 'A single lowercase word for the mood.' },
      newMemories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            salience: { type: 'number' },
          },
          required: ['text', 'salience'],
        },
      },
    },
    required: ['journal', 'mood'],
  },
} as const;
