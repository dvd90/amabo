import { describe, expect, it } from 'vitest';
import { MAX_MEMORIES, selectMemories, type Memory } from './memories.js';

describe('memory distillation (M7)', () => {
  it('keeps only the top-N by salience, so context stays flat as the journal grows', () => {
    const many: Memory[] = Array.from({ length: 1000 }, (_, i) => ({
      text: `memory ${i}`,
      salience: i,
    }));
    const picked = selectMemories(many);
    expect(picked).toHaveLength(MAX_MEMORIES);
    // The highest-salience memory survives; the lowest does not.
    expect(picked[0]!.salience).toBe(999);
    expect(picked.some((m) => m.salience === 0)).toBe(false);
  });

  it('does not pad when there are fewer memories than the cap', () => {
    expect(selectMemories([{ text: 'a', salience: 1 }])).toHaveLength(1);
  });

  it('respects a custom cap', () => {
    const mems: Memory[] = [
      { text: 'a', salience: 1 },
      { text: 'b', salience: 2 },
      { text: 'c', salience: 3 },
    ];
    expect(selectMemories(mems, 2).map((m) => m.salience)).toEqual([3, 2]);
  });
});
