'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { ROBINHOOD_CHAIN_ID } from '@/lib/robinhood';

/** Connected, on Robinhood Chain: the only state in which the Sky lets a wallet act. */
export function useReady() {
  const { address, chainId, isConnected } = useAccount();
  return { address, ready: isConnected && chainId === ROBINHOOD_CHAIN_ID };
}

export function Wallet() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  if (!isConnected) {
    return (
      <p>
        {connectors.map((c) => (
          <button key={c.uid} onClick={() => connect({ connector: c })}>
            Connect {c.name}
          </button>
        ))}
      </p>
    );
  }
  return (
    <p>
      <code>{address}</code> <button onClick={() => disconnect()}>Disconnect</button>
      {wrongChain && (
        <>
          {' '}
          <button onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}>
            Switch to Robinhood Chain ({ROBINHOOD_CHAIN_ID})
          </button>
        </>
      )}
    </p>
  );
}
