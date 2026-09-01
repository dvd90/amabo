#!/usr/bin/env bash
# Sandbox-only compiler shim — NOT part of the normal workflow.
#
# `forge test`/`forge build` download the solc binary from binaries.soliditylang.org
# on first use of a given version. Some restricted-network environments (this repo's
# own agent sandbox included) block that host. If you're on a normal machine or CI
# runner with open egress, ignore this file entirely — `forge test` just works.
#
# If you're on a host that blocks binaries.soliditylang.org but allows the npm
# registry, this script wraps the pure-JS/WASM `solc` package (installed via
# `npm install --no-save solc@<version matching foundry.toml>`) so it can stand in
# for real solc as `forge test --use ./scripts/local-solc-shim.sh`:
#   - forge's `--version` probe expects real solc's two-line banner; solcjs only
#     prints the bare version string, so this adds the banner.
#   - forge passes `--allow-paths`/`--base-path`, which solcjs's arg parser doesn't
#     recognize and exits on; this strips them.
#   - solcjs prints a stray ">>> ... SMT solvers ..." notice to stdout ahead of the
#     JSON payload, corrupting the stream forge expects to be pure JSON; this strips
#     any line starting with ">>>".
set -euo pipefail

# Point SOLCJS_BIN at a `solcjs` binary matching foundry.toml's solc_version — e.g.
# `npm install --no-save solc@0.8.28` somewhere and pass its node_modules/.bin/solcjs.
SOLCJS="${SOLCJS_BIN:?Set SOLCJS_BIN to a solcjs binary — see the comment at the top of this file}"

if [ "${1:-}" = "--version" ]; then
  echo "solc, the solidity compiler commandline interface"
  echo "Version: $("$SOLCJS" --version)"
  exit 0
fi

args=()
skip_next=0
for a in "$@"; do
  if [ "$skip_next" = "1" ]; then skip_next=0; continue; fi
  case "$a" in
    --allow-paths | --base-path)
      skip_next=1
      continue
      ;;
  esac
  args+=("$a")
done

tmp_in=$(mktemp)
tmp_out=$(mktemp)
trap 'rm -f "$tmp_in" "$tmp_out"' EXIT
cat >"$tmp_in"
"$SOLCJS" "${args[@]}" <"$tmp_in" >"$tmp_out" 2>/dev/null
grep -v '^>>>' "$tmp_out"
