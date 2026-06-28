import { describe, expect, it } from 'vitest';
import { makeMagicToken, verifyMagicToken } from './magic.js';

const SECRET = 'test-secret';

describe('magic-link tokens', () => {
  it('round-trips the (lowercased) email before expiry', () => {
    const token = makeMagicToken('Pip@Example.com', 2000, SECRET);
    expect(verifyMagicToken(token, 1000, SECRET)).toBe('pip@example.com');
  });

  it('rejects an expired token', () => {
    const token = makeMagicToken('pip@example.com', 2000, SECRET);
    expect(verifyMagicToken(token, 2001, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret (no forgery)', () => {
    const token = makeMagicToken('pip@example.com', 2000, SECRET);
    expect(verifyMagicToken(token, 1000, 'other-secret')).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = makeMagicToken('pip@example.com', 2000, SECRET);
    const [, sig] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ e: 'evil@example.com', x: 2000 })).toString(
      'base64url',
    )}.${sig}`;
    expect(verifyMagicToken(forged, 1000, SECRET)).toBeNull();
  });

  it('never throws on garbage input', () => {
    for (const junk of ['', 'no-dot', 'a.b', '....', 'x.'.repeat(10)]) {
      expect(verifyMagicToken(junk, 1000, SECRET)).toBeNull();
    }
  });
});
