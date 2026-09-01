'use client';

import { useEffect, useState } from 'react';
import type { Address, Hex } from 'viem';
import { useReadContracts } from 'wagmi';
import { starAbi } from '@/lib/abi';
import { STAR_ADDRESS } from '@/lib/robinhood';
import { Kind, creatureIdOfSoul, fetchStar, glyph, shone, type SkyStar } from '@/lib/sky';

const star = { address: STAR_ADDRESS, abi: starAbi } as const;

/** One star's page: the plaque, the glass it lives in, and who keeps it. */
export function StarPage({ tokenId }: { tokenId: string }) {
  const id = /^\d+$/.test(tokenId) ? BigInt(tokenId) : null;
  const { data, isLoading } = useReadContracts({
    contracts:
      id === null
        ? []
        : [
            { ...star, functionName: 'kindOf', args: [id] } as const,
            { ...star, functionName: 'creatureOf', args: [id] } as const,
            { ...star, functionName: 'ownerOf', args: [id] } as const,
            { ...star, functionName: 'tokenBoundAccount', args: [id] } as const,
          ],
    query: { enabled: id !== null },
  });
  const kind = Number(data?.[0]?.result ?? Kind.Unnamed);
  const soul = data?.[1]?.result as Hex | undefined;
  const owner = data?.[2]?.result as Address | undefined;
  const tba = data?.[3]?.result as Address | undefined;
  const [record, setRecord] = useState<SkyStar | null | undefined>(undefined);

  useEffect(() => {
    if (!soul || kind !== Kind.Inscribed) return;
    let live = true;
    void fetchStar(soul).then((r) => live && setRecord(r));
    return () => {
      live = false;
    };
  }, [soul, kind]);

  if (id === null) return <p className="muted">That is not a star.</p>;
  if (isLoading) return <p className="muted">Looking up…</p>;
  if (!owner) return <p className="muted">No star hangs at #{tokenId}.</p>;

  const s = record?.star;
  return (
    <section className="star-page">
      <p className="glyph big" aria-hidden="true">
        {glyph(soul ?? tokenId)}
      </p>
      {kind === Kind.Inscribed ? (
        <>
          <h2>{s ? s.name : record === null ? 'a light the glass has forgotten' : '…'}</h2>
          {s && (
            <p>
              shone {shone(s)} day{shone(s) === 1 ? '' : 's'} · born{' '}
              {new Date(s.bornAt).toLocaleDateString()} · ascended{' '}
              {new Date(s.graduatedAt).toLocaleDateString()}
            </p>
          )}
          {s && Object.keys(s.finalTraits).length > 0 && (
            <p className="muted">
              {Object.entries(s.finalTraits)
                .map(([k, v]) => `${k} ${Math.round(v * 100) / 100}`)
                .join(' · ')}
            </p>
          )}
          <p className="muted">
            soul <code>{soul}</code>
            {soul && creatureIdOfSoul(soul) && (
              <>
                {' '}
                · creature <code>{creatureIdOfSoul(soul)}</code>
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <h2>An unnamed star</h2>
          <p>A seat in the Sky, still waiting for a soul to be called into it.</p>
        </>
      )}
      <p className="muted">
        kept by <code>{owner}</code>
      </p>
      <p className="muted">
        the glass it lives in <code>{tba}</code>
      </p>
    </section>
  );
}
