# CLAUDE.md — packages/robinhood-contracts

Conventions for AI agents working in this directory specifically. Ported from
`dvd90/robinhood-app-boilerplate` (MIT, same author as this repo) via
`create-robinhood-app`. This is a **separate product from the Amabo game** — see
`docs/ROBINHOOD_CHAIN.md` at the repo root for why it lives here and how it's isolated.
Read the repo-root `CLAUDE.md` for the Amabo-wide rules (isolation, never touch
`STORY.md`/`ARCHITECTURE.md` from here); read this file for the rules specific to this
package.

## What this is

A Chassis-style protocol for on-chain projects on **Robinhood Chain (chain ID 4663)**:

- **MembershipNFT** — ERC-721; each token mints an ERC-6551 token-bound account (TBA).
- **RevenueVault** — pro-rata distribution of *explicitly deposited* revenue to current holders.
- **Factory** — EIP-1167 `cloneDeterministic` of NFT + Vault, wired and ownership-transferred in one tx.
- **IWeightStrategy** — pluggable holder-weight function (levels, tenure, whatever). Game logic lives here, never in the vault.

## Golden rules (architectural invariants — do not violate)

1. **The vault distributes only what is explicitly deposited via `depositRevenue()`.**
   Mint proceeds go to the creator/treasury and are **never** routed into the vault.
   This is the load-bearing design decision. Do not add a code path that forwards mint
   fees, sell taxes, or any auto-tax into `RevenueVault`. If a task seems to ask for it,
   stop and flag it — it changes the economic model from "revenue share" to
   "recycled deposits" and breaks the invariant the tests enforce.
2. **Game mechanics never touch money math.** Weight comes from `IWeightStrategy` via
   interface only. The vault must compile and pass its tests against a mock strategy with
   zero knowledge of levels/feeding/etc.
3. **Do not ship market-making, multi-wallet, or volume-simulation tooling.** Not in
   contracts, scripts, or frontend. Out of scope, permanently.
4. **Never hardcode an unverified address.** All chain constants live in one place
   (`src/Constants.sol` + `../../apps/robinhood-web/lib/robinhood.ts`) and every external
   address (6551 registry, account impl, stock tokens, Uniswap) must be marked
   `// VERIFY: <source>` until confirmed against official Robinhood Chain docs and the
   block explorer. A wrong address is a silent-failure bug.
5. **Trustlessness over convenience.** Clones are non-upgradeable. Owner powers are
   minimized and `Ownable2Step`. No function lets an owner pull tokens out of user TBAs
   or out of undistributed vault balances.

## Repo layout (this package)

```
src/
  MembershipNFT.sol
  RevenueVault.sol
  Factory.sol
  Constants.sol            # chain 4663 constants, all VERIFY-tagged
  strategies/
    IWeightStrategy.sol
    EqualWeightStrategy.sol # default: every holder equal
    TenureWeightStrategy.sol
  GameToken.sol             # optional, plain ERC-20, NO transfer tax
test/                       # the spec — unit, fuzz, invariant, integration
script/
  Deploy.s.sol              # writes deployments/4663.json (this package's own deployments/)
  DryRun.s.sol
  dryrun.sh                 # anvil: deploy -> mint -> deposit -> distribute
lib/                        # git submodules: forge-std, openzeppelin-contracts(-upgradeable), reference (ERC-6551)
foundry.toml
deployments/4663.json       # read by ../../apps/robinhood-web
```

The frontend (`apps/robinhood-web`, Next 15 + wagmi/viem) is a sibling, not nested here —
see `docs/ROBINHOOD_CHAIN.md` for why the layout differs from the upstream template.

## Commands (the gate)

```bash
forge fmt --check
forge test                        # unit + fuzz + invariant
pnpm -C apps/robinhood-web tsc    # if touching the frontend
pnpm -C apps/robinhood-web lint
```

`pnpm -C packages/robinhood-contracts verify` runs the Foundry half. Do not commit red.
Do not `--skip` or comment out a failing test to "get to green" — fix the code or fix
the test with a stated reason.

**This sandbox specifically** can't reach `binaries.soliditylang.org`, so bare
`forge test` will fail to download solc. Use
`forge test --use ./scripts/local-solc-shim.sh` with `SOLCJS_BIN` pointed at a
`solcjs` binary (see that script's header comment) — verified working for the full
56-test suite. A normal machine or CI runner with open egress needs none of this.

## TDD workflow (required)

1. Write or extend the failing test(s) first. Run `forge test`, confirm red.
2. Write the minimum implementation to pass. Confirm green.
3. Add fuzz/invariant runs for anything touching arithmetic or ownership before moving on.
4. `forge fmt`, then run the full gate.

Two invariants must be green before any integration work:
- **Vault conservation** — Σ distributed == deposited − carried dust; nothing minted or lost.
- **TBA control follows the NFT** — the TBA address is fixed per tokenId; its owner
  resolves through `ownerOf(tokenId)`, so after transfer the new holder controls it.

## Solidity conventions

- Solidity ^0.8.24 (pinned `0.8.28` in `foundry.toml`), `forge fmt` defaults, OpenZeppelin
  for ERC-721/Ownable2Step/Clones/ReentrancyGuard.
- Clones use `initialize()` guarded by an initializer; constructors only on implementations
  (which are then disabled for the impl via `_disableInitializers()`).
- Checks-effects-interactions; `nonReentrant` on `distribute()`. Assume reward tokens are
  hostile ERC-20s and test with a re-entering mock.
- Integer-division remainder ("dust") is carried forward in the vault, never dropped.
- Emit rich events for every state change (mint, deposit, distribute, clone) — the frontend
  and any indexer read these, not storage.
- Custom errors, not revert strings.

## Frontend conventions (`apps/robinhood-web`)

- wagmi + viem, chain pinned to 4663 from `lib/robinhood.ts`. No other chains.
- Read TBA balances by computing the 6551 account address and calling `balanceOf` on each
  reward token; value via the official price feed. Never trust a hardcoded balance.
- All addresses imported from `lib/robinhood.ts`. No inline address literals in components.

## Out of scope (do not build)

- Any auto-tax/fee path into the vault (see rule 1).
- Wallet-farming, wash-trading, or price-manipulation tooling (rule 3).
- Upgradeable clones, owner escape hatches over user funds (rule 5).

## Note on chain constants

Chain 4663 / registry / stock-token addresses in this repo originate from project notes and
are **not yet verified**. Before any real deploy, confirm every constant against official
Robinhood Chain documentation and the block explorer, and drop the `VERIFY` tags only once
confirmed.
