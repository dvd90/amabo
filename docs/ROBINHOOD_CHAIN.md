# Robinhood Chain — a membership protocol in Amabo's voice

> Lives in `packages/robinhood-contracts` (Foundry contracts) and `apps/robinhood-web`
> (Next 15 + wagmi/viem frontend). Together they are **the Sky** — `www.theamarium.com`,
> the public firmament of `STORY.md` §7½ — while the game stays at
> `app.theamarium.com`. The protocol was ported first as a standalone product; the
> lore mapping below is now the spec. It follows the isolation law of
> `ARCHITECTURE.md` §13: a leaf, never a dependency. `engine`/`ai`/`apps/api`/`apps/web`
> never import from here, and this never imports from them (the API-signed inscription
> voucher is the only bridge). The core Amabo game builds, tests, and deploys
> unaffected if these two packages were deleted outright.

## What the Sky adds on top of the port

| Piece | Status | Detail (`ARCHITECTURE.md` §13) |
|---|---|---|
| `StarNFT` (`src/StarNFT.sol`) | **built** | extends `MembershipNFT`: `kind ∈ {Unnamed, Inscribed}`; unnamed = open `mint()` capped by `maxSupply` (`seatSupply`); inscribed = `inscribe(voucher, sig)` with an EIP-712 voucher from the API's `signer` (`tokenId == 0` strikes a new star at `inscribePrice`, `tokenId` set names an unnamed star you hold, free); one soul, one star (`starOf`); soulbound — a star moves only through `offerRehome` → `acceptRehome`; `tokenURI = baseURI + id`. 27 tests. Deployed by `Deploy.s.sol` as a plain clone (`deployments/<chain>.json` → `star`, `starImpl`); `DryRun.s.sol` buys a seat |
| `GameToken` | ported | **Lumen** — same contract, fixed supply, no tax/hooks; never emitted by play, never read by the game |
| `RevenueVault` / `Factory` | ported, **unwired** for the Sky | no revenue share without counsel; no cloning needed |
| `apps/robinhood-web` | next | landing + public star gallery + claim/name + holdings; distribute UI hidden |
| `apps/api` | next | `POST /stars/:id/inscribe` → voucher (`StarNFT.Inscription`, domain `{name, "1", 4663, star}`), behind the `chain` flag, owner-scoped, ascended only |

## Provenance

Ported wholesale from `dvd90/robinhood-app-boilerplate` (MIT, same author as this
repo) — the real, already-built, already-TDD'd reference implementation, scaffolded
originally via `npx create-robinhood-app`. This isn't a from-scratch reinvention: the
contracts, their full test suite (unit + fuzz + invariant + integration), and the
frontend are the upstream project's own code, relocated to fit `amabo`'s layout
(flattened out of a nested `contracts/` dir, `apps/web` renamed `apps/robinhood-web`,
a few path constants adjusted accordingly — see git history for the exact diff).
`packages/robinhood-contracts/CLAUDE.md` carries the ported conventions and golden
rules; this file carries the lore mapping and monorepo-specific notes.

## The concept

A membership protocol where minting condenses a member into being — the "Mote"
moment — and revenue is shared pro-rata, never diluted, never slashed:

- **MembershipNFT** (ERC-721, `src/MembershipNFT.sol`) — mints sequentially, respects
  `maxSupply`, enforces mint price with excess-ETH refund, and creates each token's
  **token-bound account** (ERC-6551) at mint via the canonical registry — "the glass it
  lives in." TBA control follows the NFT: after any transfer, the new owner controls
  the account, enforced by a fuzzed invariant test.
- **RevenueVault** (`src/RevenueVault.sol`) — `depositRevenue(token, amount)` increases
  a token's distributable balance; `distribute()` is permissionless and splits pro-rata
  by the plugged `IWeightStrategy` across current holders' TBAs. Integer-division dust
  carries forward, never dropped. Never slashes, never expires unclaimed revenue.
  Reentrancy-guarded against hostile ERC-20s (tested with a re-entering mock).
- **Factory** (`src/Factory.sol`) — `cloneDeterministic`s (EIP-1167) a fresh NFT+Vault
  pair, wired and ownership-transferred in one transaction — growth by cloning full
  peers, never dilution of existing ones.
- **IWeightStrategy** (`src/strategies/`) — pluggable holder-weight function
  (`EqualWeightStrategy` is the default; `TenureWeightStrategy` ships as a reference).
  Game logic lives here, never in the vault — the vault's own tests run against a mock
  strategy with zero knowledge of levels/feeding/whatever a specific game wants.

## The mapping (why this ports cleanly from Amabo's lore)

| Amabo (`STORY.md`) | Robinhood Chain protocol |
|---|---|
| Ambra — unspent love, conserved, must go somewhere | Revenue — must always land somewhere real, never vanish, never get diluted away |
| A Mote condenses from gathered Ambra | Minting a Membership NFT condenses from protocol participation |
| The Amarium — one sealed glass world per creature | Each NFT's own ERC-6551 token-bound account |
| Multiplying — surplus splits, neither half loses | The Factory — clones are full peers, never dilution |
| Two laws: engine owns logic, AI owns only flavor | Contracts own all money logic; game mechanics (weight strategy) never touch money math |
| Lethe — neglect never punished suddenly; the door back never locks | Never slash, never expire unclaimed revenue |
| "The till never touches the soul" | **The vault never touches the soul** — see golden rule 1 |

The load-bearing golden rule (`packages/robinhood-contracts/CLAUDE.md` rule 1): the
vault distributes **only what is explicitly deposited** via `depositRevenue()`. Mint
proceeds always go to the treasury, never the vault — the wire that turns this into
"recycled deposits" instead of real revenue share is the one wire deliberately never
connected, and the tests enforce it (`test_MintProceedsNeverReachFactoryOrVault`,
`test_MintNeverTouchesVault`).

## What's resolved vs. still unknown

Resolved by the upstream boilerplate (no longer open questions):
- **Revenue source**: `depositRevenue()` is an explicit, permissionless deposit
  function — not an auto-tax or mint-fee sweep.
- **Chain**: Robinhood Chain, chain ID **4663**.

Still genuinely unknown, and every address in `src/Constants.sol` /
`apps/robinhood-web/lib/robinhood.ts` is `// VERIFY`-tagged until confirmed:
- The real RPC/explorer URLs and whether the ERC-6551 registry is actually deployed
  at the assumed canonical address on 4663.
- Tokenised-stock reward token addresses and the Uniswap router on 4663.
- Whether "graduation" (a fully-vested member exiting) is ever in scope — not built;
  no test or code path assumes it.

## Milestones (all shipped, ported from the upstream `PLAN.md`)

- **Phase 0–5 (done)** — MembershipNFT + TBA, RevenueVault, strategies, Factory,
  integration + `Deploy.s.sol`/`DryRun.s.sol`. 56 tests: unit, fuzz, and invariant
  (vault conservation; TBA-follows-NFT; factory salt/state isolation), all green.
- **Phase 6 (done)** — frontend (`apps/robinhood-web`): mint flow (`Mint.tsx`),
  holdings/claim view (`Holdings.tsx`), permissionless distribute button
  (`Distribute.tsx`), wired to wagmi/viem pinned to chain 4663. `tsc --noEmit` and
  `next lint` both clean.
- **Phase 7 (done)** — `StarNFT` for the Sky (table above): 27 unit + fuzz tests on top of
  the ported 56; `MembershipNFT` gained an internal `__MembershipNFT_init` and `_mintTo` so
  the star contract could extend it without touching the vault or factory paths.
- **Not started, not scoped**: graduation/exit vesting. No upstream code or plan
  covers it — would need its own spec before building.

## Working here

Two independent toolchains, neither part of the root `pnpm test`/`pnpm build` gate:

```bash
pnpm -C packages/robinhood-contracts verify   # forge fmt --check && forge test
pnpm -C apps/robinhood-web tsc                # typecheck
pnpm -C apps/robinhood-web lint               # next lint
```

`packages/robinhood-contracts/lib/*` (forge-std, OpenZeppelin, OpenZeppelin
Upgradeable, the ERC-6551 reference implementation) are real git submodules pinned to
the same commits as `foundry.lock` — `git submodule update --init --recursive` after
cloning, same as any Foundry project.

This sandbox's network egress blocks `binaries.soliditylang.org`, so bare
`forge test` can't download solc here. See the header comment in
`packages/robinhood-contracts/scripts/local-solc-shim.sh` for the offline workaround
used to verify all 56 tests pass in this environment. A normal dev machine or CI
runner with open egress just runs `forge test` directly.
