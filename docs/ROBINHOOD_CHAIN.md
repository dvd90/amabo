# Robinhood Chain — a membership protocol in Amabo's voice

> Lives in `packages/robinhood-contracts` (contracts) and `apps/robinhood-web`
> (frontend, not yet scaffolded). **This is a separate product from the Amabo game,
> hosted in the same monorepo for tooling convenience only.** It follows the same
> isolation law as `packages/chain` (`ARCHITECTURE.md` §13): a leaf, never a
> dependency. `engine`/`ai`/`apps/api`/`apps/web` never import from here, and this
> never imports from them. The core Amabo game builds, tests, and deploys unaffected
> if this package were deleted outright.

## The concept

A membership protocol where minting condenses a member into being — the "Mote"
moment — and revenue is shared pro-rata, never diluted, never slashed.

- **Membership NFT** (ERC-721): mints a token and strikes a deterministic, unique
  **Charter** seed (`keccak256(mintSeed, tokenId, contract)`) — flavor and identity,
  never funds. `packages/robinhood-contracts/contracts/MembershipNFT.sol`.
- **Token-bound account** (ERC-6551, planned M1): each NFT owns its own on-chain
  wallet — "the glass it lives in."
- **Revenue Vault** (planned M2): streams protocol revenue pro-rata to every member's
  token-bound account via a pull-based `claim()`. Never slashes, never expires
  unclaimed revenue.
- **Factory** (planned M3): EIP-1167 clones a fresh NFT+account+vault-share triple —
  growth by division, not dilution.

## The mapping (why this ports cleanly from Amabo's lore)

| Amabo (`STORY.md`) | Robinhood Chain protocol |
|---|---|
| Ambra — unspent love, conserved, must go somewhere | Revenue — must always land somewhere real, never vanish, never get diluted away |
| A Mote condenses from gathered Ambra | Minting a Membership NFT condenses from protocol participation |
| The Soulmark — unique, AI-elaborated but never trusted | Each NFT's Charter — deterministic on-chain traits, optional off-chain flavor, never controls funds |
| The Amarium — one sealed glass world per creature | Each NFT's own ERC-6551 token-bound account |
| Multiplying — surplus splits, neither half loses | The Factory — clones are full peers, never dilution |
| Two laws: engine owns logic, AI owns only flavor | Contracts own all money logic; anything off-chain is flavor-only |
| Lethe — neglect never punished suddenly; the door back never locks | Never slash, never expire unclaimed revenue |
| "The till never touches the soul" | **The vault never touches the soul** |

## The three laws (ported from `CLAUDE.md` in spirit, not text)

1. **The contracts own all logic.** All money movement and entitlement math is
   on-chain, deterministic, auditable. No off-chain service or AI call may move funds
   or alter who is owed what.
2. **Anything off-chain owns only flavor.** Metadata, Charter narrative text,
   notifications — never trusted, never a dependency of a financial function.
3. **The vault never touches the soul.** Never slash. Never expire unclaimed revenue.
   Never let a membership tier or engagement score reduce anyone's principal or
   accrued yield. (A static/grep invariant test, mirroring a soul-guard test, should
   assert this once the Vault lands in M2.)

## What's still genuinely unknown

- Robinhood Chain specifics: chainId, RPC, block explorer, whether ERC-6551's registry
  is already deployed there.
- Revenue source: protocol fees, a treasury sweep, or an external funder calling a
  deposit function — changes the Vault's shape.
- Tokenomics: mint price/cap, whether the Factory is permissioned, whether
  "graduation" (fully-vested exit) is in scope for v1.

## Milestones

- **M0 (done)** — `MembershipNFT` + Charter: deterministic uniqueness, collision-free
  across tokens and across differently-seeded collections, reverts for an unminted
  token. `pnpm --filter @amabo/robinhood-contracts test`.
- M1 — ERC-6551 registry integration + token-bound account wiring.
- M2 — RevenueVault (accrual/claim math, the never-slash invariant test).
- M3 — Factory (EIP-1167 clones, gas-cost test, "every clone a full peer" test).
- M4 — Frontend scaffold (`apps/robinhood-web`); mint flow, claim flow, Charter
  display.
- M5 — (if in scope) graduation/exit vesting.

## Working here

Own toolchain (Hardhat + TypeScript), not part of the root `pnpm test`/`pnpm build`
gate — run it scoped: `pnpm --filter @amabo/robinhood-contracts test`. This sandbox's
network egress blocks `binaries.soliditylang.org`, so Hardhat's own compiler
downloader can't run here; `scripts/local-compile.cjs` compiles with the
already-npm-installed `solc` package instead (fully offline) and writes
Hardhat-shaped artifacts, so `hardhat test --no-compile` runs without network. A
normal dev machine or CI runner with open egress can just run `hardhat compile`
directly — that helper script exists for this sandbox, not as the intended workflow.
