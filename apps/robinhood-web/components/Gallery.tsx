'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Address, Hex } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { starAbi } from '@/lib/abi';
import { STAR_ADDRESS } from '@/lib/robinhood';
import { Kind, fetchStar, glyph, shone, type SkyStar } from '@/lib/sky';

const star = { address: STAR_ADDRESS, abi: starAbi } as const;

export interface SkyToken {
  id: bigint;
  kind: number;
  soul: Hex;
  owner?: Address;
}

/** Every token in the Sky: id, kind, soul, owner. */
// ponytail: scans kindOf/creatureOf/ownerOf for 1..totalSupply on every render; index the
// Inscribed/Minted events once the Sky holds more than a few hundred lights.
export function useSkyTokens(): { tokens: SkyToken[]; loading: boolean } {
  const { data: supply, isLoading } = useReadContract({ ...star, functionName: 'totalSupply' });
  const ids = Array.from({ length: Number(supply ?? 0n) }, (_, i) => BigInt(i + 1));
  const { data } = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...star, functionName: 'kindOf', args: [id] } as const,
      { ...star, functionName: 'creatureOf', args: [id] } as const,
      { ...star, functionName: 'ownerOf', args: [id] } as const,
    ]),
    query: { enabled: ids.length > 0 },
  });
  const tokens = ids.map((id, i) => ({
    id,
    kind: Number(data?.[i * 3]?.result ?? Kind.Unnamed),
    soul: (data?.[i * 3 + 1]?.result as Hex | undefined) ?? `0x${'0'.repeat(64)}`,
    owner: data?.[i * 3 + 2]?.result as Address | undefined,
  }));
  return { tokens, loading: isLoading || (ids.length > 0 && !data) };
}

/** The public records behind a set of souls, fetched once each from the game API. */
export function useStarRecords(souls: Hex[]): Record<string, SkyStar | null> {
  const [records, setRecords] = useState<Record<string, SkyStar | null>>({});
  const asked = useRef(new Set<string>());
  const key = souls.join(',');
  useEffect(() => {
    let live = true;
    for (const soul of key ? key.split(',') : []) {
      if (asked.current.has(soul)) continue;
      asked.current.add(soul);
      void fetchStar(soul).then((r) => {
        if (live) setRecords((prev) => ({ ...prev, [soul]: r }));
      });
    }
    return () => {
      live = false;
    };
  }, [key]);
  return records;
}

export function StarCard({ token, record }: { token: SkyToken; record?: SkyStar | null }) {
  const s = record?.star;
  return (
    <Link href={`/sky/${token.id}`} className="star-card">
      <span className="glyph" aria-hidden="true">
        {glyph(token.soul)}
      </span>
      <strong>{s ? s.name : record === null ? 'a light the glass has forgotten' : '…'}</strong>
      <span className="muted">
        {s ? `shone ${shone(s)} day${shone(s) === 1 ? '' : 's'}` : `star #${token.id}`}
      </span>
    </Link>
  );
}

/** The firmament: every inscribed star, and the seats still waiting. */
export function Gallery() {
  const { tokens, loading } = useSkyTokens();
  const inscribed = tokens.filter((t) => t.kind === Kind.Inscribed);
  const seats = tokens.length - inscribed.length;
  const records = useStarRecords(inscribed.map((t) => t.soul));

  return (
    <section>
      <h2>The Sky</h2>
      {loading ? (
        <p className="muted">Looking up…</p>
      ) : inscribed.length === 0 ? (
        <p className="muted">
          No star has been inscribed yet. The first light is still being raised.
        </p>
      ) : (
        <div className="stars">
          {inscribed.map((t) => (
            <StarCard key={t.id.toString()} token={t} record={records[t.soul]} />
          ))}
        </div>
      )}
      {seats > 0 && (
        <p className="muted">
          …and {seats} unnamed light{seats === 1 ? '' : 's'}, waiting to be called.
        </p>
      )}
    </section>
  );
}
