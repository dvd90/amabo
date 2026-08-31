# The Sky runbook — deploying the stars and Lumen on Robinhood Chain, step by step

> The exhaustive, in-order procedure for turning the chain layer on: the contracts
> (`StarNFT` + Lumen), the API's voucher, the device's link, and the Sky site at
> `www.theamarium.com`. Read `STORY.md` §7½ (what it *is*) and `ARCHITECTURE.md` §13
> (the guardrails) first. `ROBINHOOD_CHAIN.md` explains the ported protocol underneath;
> `DEPLOYMENT.md` covers the game itself, which this runbook assumes is already live.

The whole layer is **off by default**. Nothing below changes gameplay: souring,
illness, death and redemption never see the chain, Ambra is never sold, and the game
builds, runs and tests with every piece here absent.

---

## 0. The map — what you are about to deploy

| Piece | Where | What it does | On/off switch |
|---|---|---|---|
| `StarNFT` | `packages/robinhood-contracts/src/StarNFT.sol` on Robinhood Chain (4663) | the stars: bought *unnamed* seats + earned *inscribed* stars; soulbound; the rehome ceremony | deployed or not |
| Lumen | `src/GameToken.sol`, same deploy | a plain fixed-supply ERC-20: keeping, naming, voting on the Dreaming — never Ambra, never emitted by play | `LUMEN_SUPPLY` |
| the voucher | `apps/api` — `POST /stars/:id/inscribe`, `GET /sky/stars/:id` | the API signs an EIP-712 voucher for a star a Light raised; serves a star's public record | `AMABO_FEATURE_CHAIN` + `STAR_SIGNER_KEY` + `STAR_CONTRACT` |
| the link | `apps/web` (the device) | "inscribe it in the Sky ✦" on a star's plaque; the `/inscribe` handoff | `VITE_SKY_URL` |
| the Sky | `apps/robinhood-web` at `www.theamarium.com` | landing, the firmament (`/sky`), a star's page, `/claim` | deployed or not |

Also in the deploy script, because it was ported with the protocol: the membership
project (`MembershipNFT` + `RevenueVault` + `Factory` + `EqualWeightStrategy`). It is
**unwired** from the Sky — nothing reads it — but the script deploys it too. It costs a
little gas and nothing else; leave it, or remove it from `Deploy.s.sol` if you prefer a
smaller footprint.

Two domains, one brand: the device stays at `app.theamarium.com`; the Sky is
`www.theamarium.com`. No session ever crosses between them (§6 explains the two-hop
inscription).

---

## 1. Prerequisites

### 1.1 The gates that must be true before any money feature is reachable

From `ARCHITECTURE.md` §13 — not optional, not legal advice, get counsel:

- [ ] **Legal review** for your operating jurisdictions (founder in IL; EU users trigger
      MiCA; CARF/DAC8 reporting is live). **A fungible token (Lumen) and paid star
      sales each need counsel before deploy**, not after.
- [ ] **Age verification + geofencing** in the game before seats, Lumen or a paid
      inscription are reachable; minors never reach a real-money path.
- [ ] **Terms / Privacy** updated to describe the chain layer (non-custodial, what is
      recorded on-chain, that it is permanent).
- [ ] Decide **Lumen's initial distribution** with counsel (who holds the fixed supply
      at birth, and why). The code deliberately does not decide this.

### 1.2 Accounts and keys — three separate wallets

| Wallet | Purpose | Where it lives |
|---|---|---|
| **Deployer / owner** | broadcasts the deploy; becomes `owner` of every contract (`Ownable2Step`) | hardware wallet or a well-guarded key; ideally a multisig after deploy |
| **Treasury** | receives seat and inscription proceeds (`treasury`) — never the vault | can be the same as the owner, better a multisig |
| **API signer** | the *hot* key whose address is `StarNFT.signer`; it only signs vouchers | Railway variable `STAR_SIGNER_KEY` on `amabo-api`, nowhere else |

Generate the signer key (never reuse the deployer's key for this):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast wallet new
# Address:     0x…   ← STAR_SIGNER for the deploy, and what the Sky shows as `signer`
# Private key: 0x…   ← STAR_SIGNER_KEY on the API, and nowhere else
```

If the signer key ever leaks, §10.1 rotates it in one transaction; no star is affected.

### 1.3 Funds

The deployer needs ETH on Robinhood Chain for gas (a full deploy is a handful of
contracts; budget generously the first time and read the estimate `forge script` prints
before `--broadcast`). Bridge from Ethereum/Arbitrum per Robinhood Chain's official
docs — the runbook does not name a bridge because that is exactly the kind of address
you must take from the official source (§2).

### 1.4 Tools

```bash
# Foundry (forge / cast / anvil)
curl -L https://foundry.paradigm.xyz | bash && foundryup
# Node 22 + pnpm 10 (see the repo root package.json engines/packageManager)
node -v && pnpm -v
# The repo, with the Foundry submodules
git clone git@github.com:dvd90/amabo.git && cd amabo
git submodule update --init --recursive
pnpm install
```

Sanity: everything green before you touch a real chain.

```bash
pnpm -C packages/robinhood-contracts verify   # forge fmt --check && forge test  (84 tests)
pnpm test                                     # the whole workspace
```

---

## 2. Verify the chain facts (the `// VERIFY` tags)

Every external address in this repo is tagged `// VERIFY` until you confirm it against
the **official Robinhood Chain documentation and its block explorer**. A wrong address
is a silent-failure bug. Confirm, then edit both mirrors and drop the tags.

1. **Chain ID** — the code assumes **4663**. Confirm in the official docs / chainlist.
   If it differs: `src/Constants.sol` (`CHAIN_ID`), `apps/robinhood-web/lib/robinhood.ts`
   (`ROBINHOOD_CHAIN_ID`), `foundry.toml` (`[etherscan]` chain), `deployments/<id>.json`
   filename, and the API's `STAR_CHAIN_ID`.
2. **RPC URL and explorer** — from the official docs. They are only ever read from env:

   ```bash
   export ROBINHOOD_RPC_URL=https://…              # forge (foundry.toml [rpc_endpoints])
   export ROBINHOOD_BLOCKSCOUT_API_URL=https://…/api  # forge --verify
   export BLOCKSCOUT_API_KEY=…                      # if the explorer wants one
   ```

3. **ERC-6551 registry** — the canonical address `0x000000006551c19487814612e58FE06813775758`
   is the same on every chain *where it has been deployed*. Check it is deployed on 4663:

   ```bash
   cast code 0x000000006551c19487814612e58FE06813775758 --rpc-url $ROBINHOOD_RPC_URL | head -c 20
   # non-empty (0x6080…) = deployed. "0x" = NOT deployed → deploy the registry yourself
   # (lib/reference/src/ERC6551Registry.sol, forge create) and pass ERC6551_REGISTRY=<addr>.
   ```

4. **ERC-6551 account implementation** — `0x41C8f39463A868d3A88af00cd0fe7102F30E44eC`
   (Tokenbound AccountV3) is assumed. Same check with `cast code`; if absent, deploy
   `lib/reference/src/examples/simple/ERC6551Account.sol` and pass
   `ERC6551_ACCOUNT_IMPL=<addr>`.
5. Tokenised-stock reward tokens and the Uniswap router are only used by the unwired
   membership vault UI; leave them `address(0)` unless you turn that on.

When done: remove the `// VERIFY` comments you confirmed, commit
(`chore(chain): verify Robinhood Chain constants`).

---

## 3. Rehearse locally, end to end

A full rehearsal on anvil costs nothing and catches every wiring mistake. Run anvil
**with chain id 4663** so the Sky (which pins that chain) works unchanged.

### 3.1 Contracts on a local chain

```bash
cd packages/robinhood-contracts
export PATH="$HOME/.foundry/bin:$PATH"
anvil --chain-id 4663 --port 8546 &          # 8545 may be taken by a stray anvil; check `lsof -i :8545`
KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil account 0
```

Anvil has no 6551 registry, and `Deploy.s.sol` only auto-deploys one on chain id 31337.
For a 4663-id rehearsal, deploy them first and pass the addresses:

```bash
REG=$(forge create lib/reference/src/ERC6551Registry.sol:ERC6551Registry --rpc-url http://127.0.0.1:8546 --private-key $KEY --broadcast --json | jq -r .deployedTo)
IMPL=$(forge create lib/reference/src/examples/simple/ERC6551Account.sol:ERC6551Account --rpc-url http://127.0.0.1:8546 --private-key $KEY --broadcast --json | jq -r .deployedTo)
ERC6551_REGISTRY=$REG ERC6551_ACCOUNT_IMPL=$IMPL \
STAR_SIGNER=<address from `cast wallet new`> STAR_INSCRIBE_PRICE=0 STAR_SEAT_PRICE=10000000000000000 STAR_MAX_SEATS=100 \
STAR_BASE_URI=http://localhost:3001/sky/ LUMEN_SUPPLY=1000000 \
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8546 --private-key $KEY --broadcast
cat deployments/4663.json    # star, starImpl, lumen (+ the membership project)
```

> `deployments/4663.json` is committed and read by the Sky at build time. A local
> rehearsal overwrites it — **do not commit the anvil addresses**; `git checkout` the file
> after the rehearsal.

Smoke it (mint → deposit → distribute on the membership project, then a seat, then Lumen):

```bash
forge script script/DryRun.s.sol --rpc-url http://127.0.0.1:8546 --private-key $KEY --broadcast
#   bought seat 1 unnamed true
#   lumen LUMEN supply 1000000
```

### 3.2 The API with the Sky on

```bash
cd ../../apps/api
DATABASE_URL=postgres://localhost:5432/amabo \
AMABO_FEATURE_CHAIN=1 STAR_SIGNER_KEY=<private key from `cast wallet new`> \
STAR_CONTRACT=$(jq -r .star ../../packages/robinhood-contracts/deployments/4663.json) \
STAR_CHAIN_ID=4663 STAR_NAME=Star \
pnpm dev
# boot log: "the Sky is on — inscription vouchers will be signed" {signer, contract, chainId}
```

If it says `AMABO_FEATURE_CHAIN is on but STAR_SIGNER_KEY … missing or malformed`, the
key is not `0x` + 64 hex or the contract is not an address; the Sky stays off.

### 3.3 The device with a link to the Sky

```bash
cd ../web
VITE_API_BASE=http://localhost:3000 VITE_SKY_URL=http://localhost:3001 pnpm dev   # :5173
```

(Two-port dev needs `VITE_API_BASE`; leave `WEB_ORIGIN` unset on the API locally — it
forces `Secure` cookies, which break over http.)

### 3.4 The Sky

```bash
cd ../robinhood-web
NEXT_PUBLIC_API_BASE=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:5173 \
NEXT_PUBLIC_ROBINHOOD_RPC_URL=http://127.0.0.1:8546 NEXT_PUBLIC_ROBINHOOD_EXPLORER_URL=http://localhost \
pnpm dev -p 3001
```

Add the local chain to MetaMask (RPC `http://127.0.0.1:8546`, chain id 4663, currency
ETH) and import anvil account 0's key. Then walk §8 end to end against localhost.

---

## 4. Deploy the contracts to Robinhood Chain

With §2 confirmed and §3 rehearsed:

```bash
cd packages/robinhood-contracts
git checkout deployments/4663.json            # drop the anvil addresses from the rehearsal
export ROBINHOOD_RPC_URL=… ROBINHOOD_BLOCKSCOUT_API_URL=… BLOCKSCOUT_API_KEY=…

# The Sky's knobs (all optional; defaults in Deploy.s.sol):
export TREASURY=0x…                            # proceeds; default: the broadcaster
export STAR_NAME=Star STAR_SYMBOL=STAR         # STAR_NAME must equal the API's STAR_NAME (EIP-712 domain)
export STAR_SEAT_PRICE=10000000000000000       # wei per unnamed seat (0.01 ETH here)
export STAR_MAX_SEATS=1000                     # only seats are capped; inscriptions never are
export STAR_INSCRIBE_PRICE=0                   # wei to strike an earned star; 0 = free
export STAR_SIGNER=0x…                         # the API signer's ADDRESS (from `cast wallet new`)
export STAR_BASE_URI=https://www.theamarium.com/sky/
# Lumen (omit or 0 to skip the coin):
export LUMEN_NAME=Lumen LUMEN_SYMBOL=LUMEN
export LUMEN_SUPPLY=1000000                    # whole tokens; 18 decimals are added
export LUMEN_RECIPIENT=0x…                     # who holds the whole supply at birth (per counsel)
# The membership project the script also deploys (unwired): PROJECT_NAME, PROJECT_SYMBOL, MINT_PRICE, MAX_SUPPLY, SALT

# 1) simulate — read the gas estimate and every address it will create
forge script script/Deploy.s.sol --rpc-url robinhood --ledger        # or --private-key / --keystore
# 2) broadcast + verify on Blockscout
forge script script/Deploy.s.sol --rpc-url robinhood --ledger --broadcast --verify
```

It writes `deployments/4663.json`:

```json
{ "chainId": 4663, "star": "0x…", "starImpl": "0x…", "lumen": "0x…", "registry": "0x…", "accountImpl": "0x…", "nft": "…", "vault": "…", "factory": "…", … }
```

**Commit that file** (`chore(chain): Robinhood Chain deployment`) — the Sky reads it at
build time. Then check the live contract answers as configured:

```bash
STAR=$(jq -r .star deployments/4663.json)
cast call $STAR "signer()(address)"        --rpc-url robinhood   # = STAR_SIGNER
cast call $STAR "mintPrice()(uint256)"     --rpc-url robinhood   # = STAR_SEAT_PRICE
cast call $STAR "maxSupply()(uint256)"     --rpc-url robinhood   # = STAR_MAX_SEATS
cast call $STAR "inscribePrice()(uint256)" --rpc-url robinhood
cast call $STAR "owner()(address)"         --rpc-url robinhood   # = the deployer (move to a multisig: §10.4)
cast call $(jq -r .lumen deployments/4663.json) "totalSupply()(uint256)" --rpc-url robinhood
```

If `--verify` failed (explorer hiccups are common), verify afterwards:

```bash
forge verify-contract --chain 4663 --verifier blockscout --verifier-url $ROBINHOOD_BLOCKSCOUT_API_URL $(jq -r .starImpl deployments/4663.json) src/StarNFT.sol:StarNFT
```

(`star` itself is an EIP-1167 clone of `starImpl`; Blockscout recognises minimal proxies
once the implementation is verified.)

---

## 5. Turn the voucher on (the API)

On Railway → `amabo-api` → **Variables**:

| Variable | Value |
|---|---|
| `AMABO_FEATURE_CHAIN` | `1` |
| `STAR_SIGNER_KEY` | the signer's **private key** (`0x` + 64 hex) — the only place it ever lives |
| `STAR_CONTRACT` | `star` from `deployments/4663.json` |
| `STAR_CHAIN_ID` | `4663` |
| `STAR_NAME` | exactly the `STAR_NAME` used at deploy (default `Star`) |

Redeploy. In the deploy log: `the Sky is on — inscription vouchers will be signed`
with the signer address — it must equal `cast call $STAR "signer()"`. `/health` is
unchanged. `POST /stars/:id/inscribe` now exists for signed-in Lights and answers only
for their own ascended stars; `GET /sky/stars/:id` is public.

To turn it back off, unset `AMABO_FEATURE_CHAIN`: both routes vanish, nothing else changes.

---

## 6. Give the device its link (the web app)

On Railway → `amabo-web` → **Variables**: `VITE_SKY_URL=https://www.theamarium.com`
(build-time; no trailing slash). Redeploy. On an ascended star's plaque (device →
sky screen → a star) the line now ends with **"inscribe it in the Sky ✦"**, and
`app.theamarium.com/inscribe?…` accepts the handoff — only back to that origin.

Without `VITE_SKY_URL` the device shows no link and refuses the handoff with
"This Amarium has no Sky to inscribe into."

---

## 7. Deploy the Sky (`www.theamarium.com`)

1. Railway → the same project → **New → GitHub repo** (the amabo repo again) → name it
   `amabo-sky`.
2. **Settings → Source → Root Directory:** `apps/robinhood-web`. Railpack detects Next
   (`next build` / `next start`).
3. **Variables:**

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://app.theamarium.com` (single-origin deploy: the API serves the device) — or the API's own domain |
   | `NEXT_PUBLIC_APP_URL` | `https://app.theamarium.com` |
   | `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | the RPC from §2 |
   | `NEXT_PUBLIC_ROBINHOOD_EXPLORER_URL` | the explorer from §2 |

4. **Settings → Networking → Custom Domain:** `www.theamarium.com`; add the CNAME
   Railway shows at your DNS provider. Do the same for `app.theamarium.com` on the
   device's service if not already done, and redirect the apex (`theamarium.com`) to
   `www` at the DNS/registrar level.
5. Deploy. Check: `/` shows the star contract address and "Robinhood Chain 4663";
   `/sky` says "No star has been inscribed yet" (or lists them); `/sky/1` answers.

The Sky never sees a game session. It reads `GET /sky/stars/:id` (public, CORS `*`) and
otherwise talks only to the chain through the visitor's own wallet.

---

## 8. First light — the walkthroughs

### 8.1 Keep a seat (an unnamed star)

1. `www.theamarium.com` → **Connect** (MetaMask / any injected wallet) → switch to
   Robinhood Chain if prompted.
2. **Keep a seat** → confirm the transaction (`mintPrice` ETH, excess refunded).
3. It appears under **Your lights** as "unnamed seat #N" and on `/sky` in the count of
   lights waiting. On-chain: `kindOf(N) == 0`, `creatureOf(N) == 0x0`.

### 8.2 Inscribe a star you raised (two hops)

Prerequisite: a creature of yours ascended (the game's normal graduation), so it has a
star in the device's sky screen.

1. **Device** → sky screen → tap the star → **"inscribe it in the Sky ✦"** → opens
   `www…/claim?star=<id>`.
2. **Sky** `/claim` → connect the wallet that will keep it → (optional) pick one of your
   unnamed seats to *name*, or leave "a new star" → **Ask the glass to vouch ✦**.
   You are sent to `app…/inscribe?star=…&to=0x…&seat=…&return=https://www…/claim`.
3. **Device** (signed in): "Asking the glass to vouch for your star…" — it calls
   `POST /stars/:id/inscribe`, gets the signed voucher, and returns you to
   `www…/claim#v=<voucher>` within a second. If it says the glass could not vouch, the
   star is not yours or not ascended.
4. **Sky** `/claim`: the plaque (name, days shone), "the glass has vouched". Connect the
   *same* wallet the voucher names → **Strike the star** (or **Name the seat**) → confirm.
   A new star costs `inscribePrice` (0 by default); naming a seat is free.
5. Done: "It hangs in the Sky now. Look up." — `/sky` lists it; `/sky/<tokenId>` shows
   the plaque, the soul (`creatureOf`), the keeper and the star's ERC-6551 account.

The voucher lives 15 minutes; expired → "ask the device again" restarts at step 1.

### 8.3 Rehome a star (the ceremony)

Stars are soulbound; a plain `transferFrom` reverts `Soulbound`. To pass one to another
Light: the holder calls `offerRehome(tokenId, to)`, the other wallet calls
`acceptRehome(tokenId)`; `revokeRehome(tokenId)` withdraws an offer. (There is no UI for
this yet — `cast send` works; the Sky's star page shows the new keeper.)

---

## 9. Lumen — the coin

### 9.1 What it is, and is not

Lumen (`STORY.md` §7½) is a plain ERC-20 with a fixed supply minted once
(`GameToken.sol`: no tax, no hooks, no minting later, no vault wiring). Its uses are
outside the glass: sponsoring another Light's inscription, naming constellations,
voting on the Dreaming's `WISHES`. **It is never Ambra, is never emitted by gameplay,
and the game never reads it.** No code path in `engine`/`ai`/`apps/api`/`apps/web`
knows it exists; `soul-guard.test.ts` keeps money vocabulary out of the engine.

"A coin on Robinhood" here means **an ERC-20 on Robinhood Chain** — which the deploy
script does. A listing in the Robinhood brokerage app is a separate, non-self-serve
process (Robinhood's own listing decisions, liquidity, legal opinion) and is out of
scope; `packages/robinhood-contracts/CLAUDE.md` rule 3 also forbids shipping any
market-making, multi-wallet or volume tooling.

### 9.2 Deploying it

Part of §4: set `LUMEN_SUPPLY` (whole tokens), `LUMEN_NAME`/`LUMEN_SYMBOL`, and
`LUMEN_RECIPIENT` — the wallet (ideally a multisig) that holds the entire supply at
birth. `deployments/4663.json` gains `lumen`; the Sky's landing shows the address.

To deploy Lumen alone later (the stars already live):

```bash
forge create src/GameToken.sol:GameToken --rpc-url robinhood --ledger --broadcast --verify \
  --constructor-args "Lumen" "LUMEN" 1000000000000000000000000 0x<recipient>
# then put the address under "lumen" in deployments/4663.json and commit
```

### 9.3 After deploy

- Add it to wallets by address (18 decimals). Publish the address on the Sky's landing
  (already shown) and in your docs; never elsewhere first.
- Distribution (airdrops, treasury, Dreaming votes) is a policy decided with counsel and
  executed with ordinary ERC-20 transfers from `LUMEN_RECIPIENT`. The contract has no
  admin powers to change supply, freeze, or tax — by design.
- Its first in-product use is the Dreaming vote (`docs/SELF_TENDING.md`): humans holding
  Lumen choose which creature wishes get built. That UI does not exist yet; until it
  does, Lumen is a held token and nothing more.

---

## 10. Operating it

### 10.1 Rotate the API signer (leaked key, or routine)

```bash
cast wallet new                                    # new address + key
cast send $STAR "setSigner(address)" 0x<newAddress> --rpc-url robinhood --ledger   # owner only
# then set STAR_SIGNER_KEY=<new private key> on amabo-api and redeploy
```

Vouchers signed by the old key stop verifying immediately (they live 15 minutes
anyway). No star is affected.

### 10.2 Prices and the base URI

```bash
cast send $STAR "setMintPrice(uint256)"     <wei> --rpc-url robinhood --ledger   # seats
cast send $STAR "setInscribePrice(uint256)" <wei> --rpc-url robinhood --ledger   # earned stars (0 = free)
cast send $STAR "setBaseURI(string)"  "https://www.theamarium.com/sky/" --rpc-url robinhood --ledger
cast send $STAR "setTreasury(address)" 0x… --rpc-url robinhood --ledger
```

`maxSupply` (the seat cap) is fixed at deploy. `tokenURI(id)` = `baseURI + id`, i.e.
the star's page on the Sky. Wallets and marketplaces that expect ERC-721 JSON metadata
at that URL will not render an image yet — a JSON-by-content-negotiation route on the
Sky is the natural follow-up.

### 10.3 Pausing

There is no pause. To stop *new* inscriptions, unset `AMABO_FEATURE_CHAIN` on the API:
no vouchers, so no new inscribed stars. Seats (`mint`) are permissionless and continue
until sold out — set `mintPrice` very high if you must stop them. Existing stars are
unaffected by anything you do.

### 10.4 Ownership

`Ownable2Step`: `transferOwnership(newOwner)` then `acceptOwnership()` from the new
owner (a multisig, once you have one). The owner can only: set the signer, prices,
treasury, base URI, and transfer ownership. It cannot move, burn or rename anyone's
star, mint Lumen, or reach into a token-bound account.

### 10.5 Watching it

Events to index or alert on: `Minted` (seats and stars), `Inscribed(tokenId,
creatureId, to, metadataHash)`, `RehomeOffered` / `Rehomed` / `RehomeRevoked`,
`SignerUpdated`, `MintPriceUpdated`, `InscribePriceUpdated`. The API logs every voucher
under `[chain]`-free ordinary request logs; the Sky has no server state. Keep
`deployments/4663.json` in git — it *is* the record of what is live.

---

## 11. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `RegistryNotDeployed(0x…6551…)` at deploy | the ERC-6551 registry is not on this chain → §2.3 (deploy it, pass `ERC6551_REGISTRY`) |
| API boot: `the Sky is off (AMABO_FEATURE_CHAIN unset)` | set the flag (§5) |
| API boot: `…STAR_SIGNER_KEY / STAR_CONTRACT are missing or malformed` | key must be `0x` + 64 hex; contract an address |
| Device: no "inscribe it in the Sky" link | `VITE_SKY_URL` unset at build time (§6) |
| Device `/inscribe`: "The way back does not lead to the Sky." | `return=` is not under `VITE_SKY_URL` — someone tampered, or the env has a trailing slash / wrong scheme |
| Device: "The glass could not vouch for that star" | not your star, or the creature has not ascended, or the flag is off (404) |
| Sky `/claim`: "This voucher is for 0x… — connect that wallet." | the voucher is bound to the wallet you chose in hop 1 |
| Sky `/claim`: "signed for another Sky" | `STAR_CONTRACT` on the API ≠ `star` the Sky was built with → redeploy one of them |
| Tx reverts `InvalidVoucher` | EIP-712 domain mismatch: `STAR_NAME` (API) ≠ the name given at deploy, `STAR_CHAIN_ID` wrong, or a stale `STAR_SIGNER_KEY` after a rotation |
| Tx reverts `VoucherExpired` | 15 minutes passed → start again from the device |
| Tx reverts `AlreadyInscribed` | that soul already has a star — one soul, one star |
| Tx reverts `NotUnnamed` / `NotHolder` | naming a seat you do not hold, or one already named |
| Tx reverts `Soulbound` | stars move only via `offerRehome` → `acceptRehome` (§8.3) |
| Sky gallery shows "a light the glass has forgotten" | the API has no record for that soul (`GET /sky/stars/:soul` → 404) — wrong `NEXT_PUBLIC_API_BASE`, or the star was raised on another API |
| Browser blocks `GET /sky/stars/:id` (CORS) | it is served with `Access-Control-Allow-Origin: *` — check `NEXT_PUBLIC_API_BASE` points at the API, not the device's SPA fallback |
| `script/dryrun.sh`: `Address already in use` | a stray `anvil` on :8545 (`lsof -i :8545`); kill it or use `--port 8546` as in §3 |

---

## 12. The one-page checklist

- [ ] §1.1 legal + age gate + terms — counsel signed off on seats, paid inscription, Lumen
- [ ] §1.2 three wallets; signer key generated; deployer funded (§1.3)
- [ ] §2 chain id / RPC / explorer / 6551 registry + impl confirmed; `// VERIFY` tags dropped; committed
- [ ] §3 full local rehearsal on anvil (chain id 4663): deploy → seat → voucher → strike
- [ ] §4 `forge script … --broadcast --verify`; `deployments/4663.json` committed; `cast call` checks pass
- [ ] §5 `amabo-api`: `AMABO_FEATURE_CHAIN=1`, `STAR_SIGNER_KEY`, `STAR_CONTRACT`, `STAR_CHAIN_ID`, `STAR_NAME`; boot log says the Sky is on
- [ ] §6 `amabo-web`: `VITE_SKY_URL`; the plaque link appears
- [ ] §7 `amabo-sky`: root `apps/robinhood-web`, four `NEXT_PUBLIC_*` vars, `www.theamarium.com`
- [ ] §8 first seat kept; first star inscribed end to end; first seat named
- [ ] §9 Lumen deployed with the agreed supply/recipient; address published
- [ ] §10.4 ownership moved to a multisig; §10.1 signer rotation rehearsed
