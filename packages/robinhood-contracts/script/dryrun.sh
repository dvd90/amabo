#!/usr/bin/env bash
# Local dry run: anvil → Deploy.s.sol → DryRun.s.sol (mint → deposit → distribute).
# Pass a 4663 RPC URL as $1 to fork Robinhood Chain instead of a blank chain (VERIFY URL first).
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH" # foundryup installs here; harmless if already on PATH
cd "$(dirname "$0")/.."
KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 # anvil account 0
anvil --silent ${1:+--fork-url "$1"} &
ANVIL=$!
trap 'kill $ANVIL' EXIT
sleep 2
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key "$KEY" --broadcast -q
# Print only the script's console.log lines: what happened, in plain words.
forge script script/DryRun.s.sol --rpc-url http://127.0.0.1:8545 --private-key "$KEY" --broadcast | awk '/== Logs ==/{f=1;next} /^## /{f=0} f'
cat "deployments/$(cast chain-id --rpc-url http://127.0.0.1:8545).json" 2>/dev/null || cat deployments/31337.json
