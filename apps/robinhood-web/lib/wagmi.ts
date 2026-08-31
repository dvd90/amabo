import { createConfig, http, injected } from "wagmi";
import { robinhoodChain } from "./robinhood";

// Chain 4663 only. No other chains (CLAUDE.md frontend conventions).
export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  connectors: [injected()],
  transports: { [robinhoodChain.id]: http() },
  ssr: true,
});
