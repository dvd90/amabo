"use client";

import { formatUnits } from "viem";
import { useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, vaultAbi } from "@/lib/abi";
import { REWARD_TOKENS, VAULT_ADDRESS } from "@/lib/robinhood";

/// Pending (deposited, undistributed) revenue per reward token + permissionless distribute button.
export function Distribute({ disabled }: { disabled: boolean }) {
  const { data, refetch } = useReadContracts({
    contracts: REWARD_TOKENS.flatMap((token) => [
      { address: VAULT_ADDRESS, abi: vaultAbi, functionName: "distributable", args: [token] } as const,
      { address: token, abi: erc20Abi, functionName: "symbol" } as const,
      { address: token, abi: erc20Abi, functionName: "decimals" } as const,
    ]),
    query: { enabled: REWARD_TOKENS.length > 0 },
  });
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });
  if (isSuccess) void refetch();

  return (
    <section>
      <h2>Next distribution</h2>
      {REWARD_TOKENS.length === 0 && <p className="muted">No reward tokens configured.</p>}
      <table>
        <tbody>
          {REWARD_TOKENS.map((token, i) => {
            const pending = data?.[i * 3]?.result as bigint | undefined;
            const symbol = data?.[i * 3 + 1]?.result as string | undefined;
            const decimals = data?.[i * 3 + 2]?.result as number | undefined;
            return (
              <tr key={token}>
                <td>{symbol ?? <code>{token}</code>}</td>
                <td>{pending !== undefined && decimals !== undefined ? formatUnits(pending, decimals) : "…"} pending</td>
                <td>
                  <button
                    disabled={disabled || !pending || isPending || confirming}
                    onClick={() => writeContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: "distribute", args: [token] })}
                  >
                    Distribute
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="muted">{error.message.split("\n")[0]}</p>}
    </section>
  );
}
