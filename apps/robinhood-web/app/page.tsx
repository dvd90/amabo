"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Distribute } from "@/components/Distribute";
import { Holdings } from "@/components/Holdings";
import { Mint } from "@/components/Mint";
import { IS_DEPLOYED, NFT_ADDRESS, ROBINHOOD_CHAIN_ID, VAULT_ADDRESS } from "@/lib/robinhood";

export default function Home() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  return (
    <main>
      <h1>Membership</h1>
      <p className="muted">
        NFT <code>{NFT_ADDRESS}</code> · Vault <code>{VAULT_ADDRESS}</code> · chain {ROBINHOOD_CHAIN_ID}
      </p>

      {!IS_DEPLOYED && (
        <section>
          Not deployed yet. Run <code>forge script script/Deploy.s.sol --rpc-url robinhood --broadcast</code> to
          write <code>deployments/4663.json</code>.
        </section>
      )}

      <section>
        {isConnected ? (
          <>
            <span>
              Connected <code>{address}</code>
            </span>{" "}
            <button onClick={() => disconnect()}>Disconnect</button>
            {wrongChain && (
              <>
                {" "}
                <button onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}>Switch to chain {ROBINHOOD_CHAIN_ID}</button>
              </>
            )}
          </>
        ) : (
          connectors.map((c) => (
            <button key={c.uid} onClick={() => connect({ connector: c })}>
              Connect {c.name}
            </button>
          ))
        )}
      </section>

      {IS_DEPLOYED && (
        <>
          <Mint disabled={!isConnected || wrongChain} />
          <Holdings owner={address} disabled={!isConnected || wrongChain} />
          <Distribute disabled={!isConnected || wrongChain} />
        </>
      )}
    </main>
  );
}
