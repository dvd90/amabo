"use client";

import { formatUnits, type Address } from "viem";
import { useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, nftAbi, vaultAbi } from "@/lib/abi";
import { NFT_ADDRESS, REWARD_TOKENS, VAULT_ADDRESS } from "@/lib/robinhood";

const nft = { address: NFT_ADDRESS, abi: nftAbi } as const;

/// Tokens owned by `owner`: each token's 6551 account, reward balances sitting in it, and claimable shares.
// ponytail: scans ownerOf(1..totalSupply) on every render; index Minted/Transfer events if maxSupply grows large.
export function Holdings({ owner, disabled }: { owner?: Address; disabled: boolean }) {
  const { data: supply } = useReadContract({ ...nft, functionName: "totalSupply" });
  const ids = Array.from({ length: Number(supply ?? 0n) }, (_, i) => BigInt(i + 1));

  const { data: owners } = useReadContracts({
    contracts: ids.map((id) => ({ ...nft, functionName: "ownerOf", args: [id] })),
    query: { enabled: ids.length > 0 },
  });
  const owned = ids.filter((_, i) => (owners?.[i]?.result as Address | undefined)?.toLowerCase() === owner?.toLowerCase());

  const { data: tbas } = useReadContracts({
    contracts: owned.map((id) => ({ ...nft, functionName: "tokenBoundAccount", args: [id] })),
    query: { enabled: owned.length > 0 },
  });
  const tbaList = (tbas ?? []).map((r) => r.result as Address | undefined).filter((a): a is Address => !!a);

  const { data: meta } = useReadContracts({
    contracts: REWARD_TOKENS.flatMap((token) => [
      { address: token, abi: erc20Abi, functionName: "symbol" } as const,
      { address: token, abi: erc20Abi, functionName: "decimals" } as const,
    ]),
    query: { enabled: REWARD_TOKENS.length > 0 },
  });
  // Per (owned token, reward token): [balanceOf(tba), claimable(token, id)]
  const { data: amounts, refetch } = useReadContracts({
    contracts: owned.flatMap((id, i) =>
      REWARD_TOKENS.flatMap((token) => [
        { address: token, abi: erc20Abi, functionName: "balanceOf", args: [tbaList[i] ?? NFT_ADDRESS] } as const,
        { address: VAULT_ADDRESS, abi: vaultAbi, functionName: "claimable", args: [token, id] } as const,
      ]),
    ),
    query: { enabled: tbaList.length === owned.length && owned.length > 0 && REWARD_TOKENS.length > 0 },
  });
  const cell = (i: number, t: number, k: 0 | 1) => amounts?.[(i * REWARD_TOKENS.length + t) * 2 + k]?.result as bigint | undefined;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });
  if (isSuccess) void refetch();

  if (!owner) return null;

  return (
    <section>
      <h2>Your memberships</h2>
      {owned.length === 0 && <p className="muted">None yet.</p>}
      {REWARD_TOKENS.length === 0 && (
        <p className="muted">
          Set <code>NEXT_PUBLIC_REWARD_TOKENS</code> to show reward balances (VERIFY addresses first).
        </p>
      )}
      <table>
        <tbody>
          {owned.map((id, i) => (
            <tr key={id.toString()}>
              <td>#{id.toString()}</td>
              <td>
                <code>{tbaList[i] ?? "…"}</code>
              </td>
              <td>
                {REWARD_TOKENS.map((token, t) => {
                  const symbol = meta?.[t * 2]?.result as string | undefined;
                  const decimals = meta?.[t * 2 + 1]?.result as number | undefined;
                  const fmt = (v?: bigint) => (v !== undefined && decimals !== undefined ? formatUnits(v, decimals) : "…");
                  const pending = cell(i, t, 1);
                  return (
                    <div key={token}>
                      {fmt(cell(i, t, 0))} {symbol ?? ""}
                      {pending ? (
                        <>
                          {" "}
                          <span className="muted">+{fmt(pending)} claimable</span>{" "}
                          <button
                            disabled={disabled || isPending || confirming}
                            onClick={() => writeContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: "claim", args: [token, owned] })}
                          >
                            Claim
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="muted">{error.message.split("\n")[0]}</p>}
      {/* VERIFY: value in USD via the official Robinhood Chain price feed once its address is confirmed. */}
    </section>
  );
}
