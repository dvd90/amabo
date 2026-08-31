// Minimal ABIs for the frontend. Keep in sync with contracts/src.
export const nftAbi = [
  { type: "function", name: "mint", stateMutability: "payable", inputs: [], outputs: [{ type: "uint256" }, { type: "address" }] },
  { type: "function", name: "mintPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "tokenBoundAccount", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

export const vaultAbi = [
  { type: "function", name: "distributable", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "distribute", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }], outputs: [] },
  { type: "function", name: "claimable", stateMutability: "view", inputs: [{ name: "token", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "tokenIds", type: "uint256[]" }], outputs: [] },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;
