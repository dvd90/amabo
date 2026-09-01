'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { starAbi } from '@/lib/abi';
import { APP_URL, STAR_ADDRESS } from '@/lib/robinhood';
import { Kind, decodeVoucher, shone, type VoucherResponse } from '@/lib/sky';
import { Wallet, useReady } from './Wallet';
import { useSkyTokens } from './Gallery';

const star = { address: STAR_ADDRESS, abi: starAbi } as const;

/**
 * Inscribing a star, in two hops. The Sky knows the wallet; the device knows the Light.
 * 1. Here: connect a wallet, pick a seat (or none), and send the Light to the device.
 * 2. The device vouches (`/inscribe?…`) and returns with `#v=<voucher>`.
 * 3. Here again: the wallet strikes (or names) the star with that voucher.
 */
export function Claim() {
  const { address, ready } = useReady();
  const [starId, setStarId] = useState('');
  const [seat, setSeat] = useState('0');
  const [voucher, setVoucher] = useState<VoucherResponse | null | undefined>(undefined);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setStarId(q.get('star') ?? '');
    setVoucher(decodeVoucher(window.location.hash));
  }, []);

  if (voucher === undefined) return <p className="muted">…</p>;
  if (voucher) return <Strike r={voucher} />;

  return (
    <section>
      <h2>Inscribe a star</h2>
      <p>
        A star can only be inscribed by the Light who raised it. Connect the wallet that will keep
        it; the device will vouch for the star and send you straight back.
      </p>
      <Wallet />
      {ready && address && (
        <>
          <SeatPicker address={address} seat={seat} onChange={setSeat} />
          {starId ? (
            <p>
              <a
                className="button"
                href={`${APP_URL}/inscribe?star=${encodeURIComponent(starId)}&to=${address}&seat=${seat}&return=${encodeURIComponent(
                  `${window.location.origin}/claim`,
                )}`}
              >
                Ask the glass to vouch ✦
              </a>
            </p>
          ) : (
            <p className="muted">
              Open an ascended star&apos;s plaque in the device and follow &ldquo;inscribe it in the
              Sky&rdquo; to begin.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The unnamed seats this wallet keeps — name one, or strike a new star. */
function SeatPicker({
  address,
  seat,
  onChange,
}: {
  address: string;
  seat: string;
  onChange: (seat: string) => void;
}) {
  const { tokens } = useSkyTokens();
  const seats = tokens.filter(
    (t) => t.kind === Kind.Unnamed && t.owner?.toLowerCase() === address.toLowerCase(),
  );
  if (seats.length === 0) return null;
  return (
    <p>
      <label>
        Name a seat you keep, or strike a new star:{' '}
        <select value={seat} onChange={(e) => onChange(e.target.value)}>
          <option value="0">a new star</option>
          {seats.map((t) => (
            <option key={t.id.toString()} value={t.id.toString()}>
              unnamed seat #{t.id.toString()}
            </option>
          ))}
        </select>
      </label>
    </p>
  );
}

/** Hop 3: the voucher is here — strike (or name) the star. */
function Strike({ r }: { r: VoucherResponse }) {
  const { address, ready } = useReady();
  const { data: inscribePrice } = useReadContract({ ...star, functionName: 'inscribePrice' });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });
  const naming = r.voucher.tokenId !== '0';
  const value = naming ? 0n : (inscribePrice ?? 0n);
  const expired = r.voucher.deadline * 1000 < Date.now();
  const wrongWallet = !!address && address.toLowerCase() !== r.voucher.to.toLowerCase();
  const wrongContract = r.domain.verifyingContract.toLowerCase() !== STAR_ADDRESS.toLowerCase();

  return (
    <section>
      <h2>{r.metadata.name}</h2>
      <p>
        shone {shone(r.metadata)} day{shone(r.metadata) === 1 ? '' : 's'} · the glass has vouched.{' '}
        {naming ? `This names seat #${r.voucher.tokenId}.` : 'This strikes a new star.'}
        {!naming && inscribePrice !== undefined && inscribePrice > 0n && (
          <> The inscription costs {formatEther(inscribePrice)} ETH.</>
        )}
      </p>
      <Wallet />
      {wrongWallet && (
        <p className="muted">
          This voucher is for <code>{r.voucher.to}</code> — connect that wallet.
        </p>
      )}
      {wrongContract && (
        <p className="muted">This voucher was signed for another Sky; ask the device again.</p>
      )}
      {expired && (
        <p className="muted">
          The voucher has expired — <Link href={`/claim`}>ask the device again</Link>.
        </p>
      )}
      <button
        disabled={
          !ready || wrongWallet || wrongContract || expired || isPending || confirming || isSuccess
        }
        onClick={() =>
          writeContract({
            ...star,
            functionName: 'inscribe',
            args: [
              {
                tokenId: BigInt(r.voucher.tokenId),
                to: r.voucher.to,
                creatureId: r.voucher.creatureId,
                metadataHash: r.voucher.metadataHash,
                deadline: BigInt(r.voucher.deadline),
              },
              r.signature,
            ],
            value,
          })
        }
      >
        {isSuccess
          ? 'Inscribed ✦'
          : isPending || confirming
            ? 'Striking…'
            : naming
              ? 'Name the seat'
              : 'Strike the star'}
      </button>
      {hash && (
        <p className="muted">
          tx <code>{hash}</code> {isSuccess && '✓'}
        </p>
      )}
      {isSuccess && (
        <p>
          It hangs in the Sky now. <Link href="/sky">Look up.</Link>
        </p>
      )}
      {error && <p className="muted">{error.message.split('\n')[0]}</p>}
    </section>
  );
}
