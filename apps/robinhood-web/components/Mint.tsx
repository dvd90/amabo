'use client';

import { formatEther } from 'viem';
import { useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { nftAbi } from '@/lib/abi';
import { NFT_ADDRESS } from '@/lib/robinhood';

export function Mint({ disabled }: { disabled: boolean }) {
  const nft = { address: NFT_ADDRESS, abi: nftAbi } as const;
  const { data, refetch } = useReadContracts({
    contracts: [
      { ...nft, functionName: 'mintPrice' },
      { ...nft, functionName: 'totalSupply' },
      { ...nft, functionName: 'maxSupply' },
    ],
  });
  const [price, supply, max] = data?.map((r) => r.result) ?? [];
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });
  if (isSuccess) void refetch();

  const soldOut = supply !== undefined && max !== undefined && supply >= max;

  return (
    <section>
      <h2>Mint</h2>
      <p>
        {price !== undefined ? `${formatEther(price)} ETH` : '…'} · {supply?.toString() ?? '…'} /{' '}
        {max?.toString() ?? '…'} minted
      </p>
      <button
        disabled={disabled || price === undefined || soldOut || isPending || confirming}
        onClick={() => writeContract({ ...nft, functionName: 'mint', value: price })}
      >
        {soldOut ? 'Sold out' : isPending || confirming ? 'Minting…' : 'Mint'}
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
