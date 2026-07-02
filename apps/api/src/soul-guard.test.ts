/**
 * soul-guard.test.ts — the law of the phase, made executable (LAUNCH_PLAN.md L5):
 * THE TILL NEVER TOUCHES THE SOUL. The engine owns souring, illness, death and
 * redemption; if any monetization vocabulary ever appears in engine source, this
 * test fails and blocks the merge — by CLAUDE.md's own rule, a failing acceptance
 * test blocks merge, so the law enforces itself.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ENGINE_SRC = fileURLToPath(new URL('../../../packages/engine/src', import.meta.url));
const FORBIDDEN = /stripe|lantern|entitlement|billing|checkout|paywall|premium|subscri/i;

describe('the guard: the till never touches the soul', () => {
  it('engine source knows nothing of money — no tiers in souring, illness, death, redemption', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(ENGINE_SRC)) {
      if (!file.endsWith('.ts')) continue;
      const text = readFileSync(join(ENGINE_SRC, file), 'utf8');
      const hit = text.match(FORBIDDEN);
      if (hit) offenders.push(`${file}: "${hit[0]}"`);
    }
    expect(offenders).toEqual([]);
  });
});
