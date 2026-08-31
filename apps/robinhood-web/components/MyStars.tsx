'use client';

import Link from 'next/link';
import { Kind, glyph } from '@/lib/sky';
import { useReady } from './Wallet';
import { useSkyTokens, useStarRecords } from './Gallery';

/** The lights this wallet keeps: inscribed stars and unnamed seats. */
export function MyStars() {
  const { address, ready } = useReady();
  const { tokens } = useSkyTokens();
  const mine = tokens.filter((t) => t.owner?.toLowerCase() === address?.toLowerCase());
  const records = useStarRecords(mine.filter((t) => t.kind === Kind.Inscribed).map((t) => t.soul));

  if (!ready) return null;
  return (
    <section>
      <h2>Your lights</h2>
      {mine.length === 0 ? (
        <p className="muted">You keep no light in the Sky yet.</p>
      ) : (
        <ul className="lights">
          {mine.map((t) => (
            <li key={t.id.toString()}>
              <span aria-hidden="true">{glyph(t.soul)}</span>{' '}
              <Link href={`/sky/${t.id}`}>
                {t.kind === Kind.Inscribed
                  ? (records[t.soul]?.star.name ?? `star #${t.id}`)
                  : `unnamed seat #${t.id}`}
              </Link>
              {t.kind === Kind.Unnamed && (
                <span className="muted">
                  {' '}
                  — to name it, open an ascended star&apos;s plaque in the device and choose this
                  seat
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
