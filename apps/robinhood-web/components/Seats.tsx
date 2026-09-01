'use client';

import { formatEther } from 'viem';
import { useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { starAbi } from '@/lib/abi';
import { STAR_ADDRESS } from '@/lib/robinhood';
import { useReady } from './Wallet';

const star = { address: STAR_ADDRESS, abi: starAbi } as const;

/** Buy a seat: an unnamed star. It gives its keeper nothing in the glass — ever. */
export function Seats() {
  const { ready } = useReady();
  const { data, refetch } = useReadContracts({
    contracts: [
      { ...star, functionName: 'mintPrice' },
      { ...star, functionName: 'seatSupply' },
      { ...star, functionName: 'maxSupply' },
    ],
  });
  const [price, sold, max] = data?.map((r) => r.result as bigint | undefined) ?? [];
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });
  if (isSuccess) void refetch();
  const soldOut = sold !== undefined && max !== undefined && sold >= max;

  return (
    <section>
      <h2>Keep a seat</h2>
      <p>
        An <strong>unnamed star</strong> — a light in the Sky no soul has reached yet, waiting in
        the hall of light to be called. It has a glyph of its own and a place in the firmament, and
        nothing else: no Ambra, no shelf, no advantage inside the glass. When a creature of yours
        ascends, you may name the seat after it.
      </p>
      <p>
        {price !== undefined ? `${formatEther(price)} ETH` : '…'} · {sold?.toString() ?? '…'} /{' '}
        {max?.toString() ?? '…'} seats kept
      </p>
      <button
        disabled={!ready || price === undefined || soldOut || isPending || confirming}
        onClick={() => writeContract({ ...star, functionName: 'mint', value: price })}
      >
        {soldOut ? 'Every seat is kept' : isPending || confirming ? 'Keeping…' : 'Keep a seat'}
      </button>
      {hash && (
        <p className="muted">
          tx <code>{hash}</code> {isSuccess && '✓'}
        </p>
      )}
      {error && <p className="muted">{error.message.split('\n')[0]}</p>}
    </section>
  );
}
