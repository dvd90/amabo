#!/usr/bin/env bash
# Deploy the Sky (StarNFT + Lumen, plus the ported membership project) to Robinhood Chain.
# One command for the runbook's §4 (docs/SKY_RUNBOOK.md), testnet or mainnet:
#
#   scripts/deploy-sky.sh testnet   --account amabo-testnet-deployer --password amabo-testnet
#   scripts/deploy-sky.sh mainnet   --ledger            # or --account <keystore> --password …
#
# Anything after the network is passed to `forge` as the signer flags. Env knobs (STAR_*,
# LUMEN_*, TREASURY, …) are read by Deploy.s.sol; see its header. On testnet the Tokenbound
# AccountV3 is absent, so this deploys erc6551's reference ERC6551Account first (idempotent:
# reuses ERC6551_ACCOUNT_IMPL if you export one that has code).
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."

NET="${1:?usage: deploy-sky.sh testnet|mainnet [forge signer flags]}"; shift
case "$NET" in
  testnet) RPC="${ROBINHOOD_RPC_URL:-https://rpc.testnet.chain.robinhood.com/rpc}"; CHAIN=46630
           VERIFIER="${ROBINHOOD_BLOCKSCOUT_API_URL:-https://explorer.testnet.chain.robinhood.com/api}";;
  mainnet) RPC="${ROBINHOOD_RPC_URL:-https://rpc.mainnet.chain.robinhood.com}"; CHAIN=4663
           VERIFIER="${ROBINHOOD_BLOCKSCOUT_API_URL:-https://robinhoodchain.blockscout.com/api}";;
  *) echo "unknown network: $NET" >&2; exit 2;;
esac
SIGNER=("$@")

got=$(cast chain-id --rpc-url "$RPC"); [ "$got" = "$CHAIN" ] || { echo "RPC answers chain $got, expected $CHAIN" >&2; exit 1; }
addr=$(cast wallet address "${SIGNER[@]}")
echo "network $NET (chain $CHAIN) · deployer $addr · balance $(cast balance "$addr" --rpc-url "$RPC" --ether) ETH"

# The 6551 registry must exist; the account implementation we can supply ourselves.
REG="${ERC6551_REGISTRY:-0x000000006551c19487814612e58FE06813775758}"
[ "$(cast code "$REG" --rpc-url "$RPC")" != "0x" ] || { echo "ERC-6551 registry missing at $REG on chain $CHAIN" >&2; exit 1; }
IMPL="${ERC6551_ACCOUNT_IMPL:-0x41C8f39463A868d3A88af00cd0fe7102F30E44eC}"
if [ "$(cast code "$IMPL" --rpc-url "$RPC")" = "0x" ]; then
  echo "no ERC-6551 account implementation at $IMPL — deploying the reference ERC6551Account"
  IMPL=$(forge create lib/reference/src/examples/simple/ERC6551Account.sol:ERC6551Account \
    --rpc-url "$RPC" "${SIGNER[@]}" --broadcast --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["deployedTo"])')
  echo "ERC6551Account → $IMPL"
fi

export ERC6551_REGISTRY="$REG" ERC6551_ACCOUNT_IMPL="$IMPL"
# Verification is best-effort (SKIP_VERIFY=1 turns it off, e.g. on a local anvil): a Blockscout
# hiccup must not fail the deploy itself — the broadcast is resumed without verification.
if [ -z "${SKIP_VERIFY:-}" ]; then
  forge script script/Deploy.s.sol --rpc-url "$RPC" "${SIGNER[@]}" --broadcast \
    --verify --verifier blockscout --verifier-url "$VERIFIER" || \
  forge script script/Deploy.s.sol --rpc-url "$RPC" "${SIGNER[@]}" --broadcast --resume
else
  forge script script/Deploy.s.sol --rpc-url "$RPC" "${SIGNER[@]}" --broadcast
fi

echo; echo "deployments/$CHAIN.json:"; cat "deployments/$CHAIN.json"
STAR=$(python3 -c "import json; print(json.load(open('deployments/$CHAIN.json'))['star'])")
echo; echo "star $STAR: signer=$(cast call "$STAR" 'signer()(address)' --rpc-url "$RPC") seatPrice=$(cast call "$STAR" 'mintPrice()(uint256)' --rpc-url "$RPC") maxSeats=$(cast call "$STAR" 'maxSupply()(uint256)' --rpc-url "$RPC") inscribePrice=$(cast call "$STAR" 'inscribePrice()(uint256)' --rpc-url "$RPC")"
