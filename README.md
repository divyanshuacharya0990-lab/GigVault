# GigVault — backend scaffold

A work passport for gig workers: Account Aggregator bank data → Anon Aadhaar identity
binding → a Groth16 threshold commitment (tenure / weeks paid / monthly income) → a
soulbound token (ERC-721 + ERC-5192) that answers true/false to a verifier in under two
seconds, without ever showing them a rupee figure.

This is **Level 1** per the deck's own trust ladder: the pull from the bank is
provable (AA-signed consent artefact + envelope published alongside the commitment),
but the arithmetic that turns 156 weekly credits into `tenureMonths / weeksPaid /
monthlyIncome` is still done by us, the operator, not proved in-circuit. Level 2/3 are
explicitly out of scope for this build — see "What Level 1 actually means" below.

## Quick start

```bash
cd backend
npm install
cp .env.example .env
npm run circuit:build     # Node script, works in PowerShell/WSL/mac: needs circom on PATH (or CIRCOM=<path>)
npm run dev                # starts Fastify on :4000 with SQLite at ./data/gigvault.db
# then open http://localhost:4000 for the rider + verifier client
```

One command, one repo, SQLite file-based — nothing else to stand up for the demo.

For contracts:

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat node                     # local chain in one terminal
npx hardhat run scripts/deploy.ts --network localhost   # in another
# for Amoy: npx hardhat run scripts/deploy.ts --network amoy   (needs .env AMOY_RPC_URL + PRIVATE_KEY)
# offline (solc download blocked): add  --config hardhat.offline.config.ts  to every hardhat command
```

Then, to put the commitment on chain from the backend: set `CHAIN_MODE=on` in
`backend/.env` (see `.env.example`), restart `npm run dev`, and run
`node scripts/http-smoke.mjs` — it drives the full demo path and prints every refusal.

## What Level 1 actually means (read this before demoing)

The deck's Entry 2 says "his name matched to the bank's" and calls this identity
binding. **This is not a circuit constraint in this build.** Anon Aadhaar's stock
library gives you a nullifier (one human, one passport) plus optionally
age-above-18/gender/state/pincode — not name. So here:

1. The rider's phone verifies the Aadhaar Secure QR signature locally and decodes the
   name from the QR payload (this never leaves the phone unencrypted).
2. The phone sends the decoded name — as plain data, not a circuit output — to the
   operator alongside the Anon Aadhaar nullifier proof.
3. The operator matches that name string against the AA-fetched bank account holder
   name **off-circuit**, in the `/issue` route (`src/routes/issue.ts`), and only
   proceeds if they match.

Say this on stage exactly as written: *"identity binding is a signed nullifier plus an
off-circuit name match against the bank record — not an in-circuit name constraint."*
Claiming more than that is the Level-0-dressed-as-Level-1 mistake the deck's own trust
table warns against.

**Where the income/tenure numbers live.** The operator (this backend) is the only
party that ever sees plaintext `tenureMonths`, `weeksPaid`, `monthlyIncome`, and the
`salt`. The Groth16 proof is generated once, server-side, in `/issue`
(`src/zk/prove.ts`), immediately after the numbers are derived from the AA fetch. It is
stored (`proofs` table) and handed out verbatim at `/present`. **The rider's phone
never receives the raw figures or the salt** — if it did, the phone could re-prove
arbitrary values and this would quietly become Level 3 while still being presented as
Level 1. The phone only ever holds: the token, the stored proof, and the Anon Aadhaar
proof it generates itself for identity.

## Selective disclosure — the design decision, and why it is not a hole

A rider may claim **any tier at or below** the highest one their figures clear. Claiming
above is impossible by construction: the circuit constrains `value >= boundary[idx]`, so
an over-claim has no satisfying witness and `fullProve` simply fails. `/issue` also
checks the request against the derived figures first, so an over-claim returns a named
`422 TIER_CLAIM_TOO_HIGH` instead of an opaque witness-calculator error.

Claiming downward leaks nothing extra. The tier set is fixed and enumerated, so there is
no verifier-chosen threshold to binary-search against (zk-reference.md, "Choosing what is
public"). A rider who shows "at least 24 months" once and "at least 36 months" later has
disclosed "at least 36 months" — exactly what claiming maximally would have disclosed the
first time. There is no incremental leak beyond the lattice.

Default with no `tierClaims` in the request body: highest tier cleared. Pass a partial
`tierClaims` object to disclose less:

```bash
curl -X POST localhost:4000/issue -H 'content-type: application/json' -d '{
  "sessionId": "...",
  "anonAadhaar": {"nullifier":"n1","proof":{},"publicSignals":[],"decodedName":"RAMESH KUMAR"},
  "tierClaims": {"tenureTierIdx": 3, "weeksTierIdx": 3, "incomeTierIdx": 3}
}'
```

That particular call reproduces the submitted deck's card exactly — *at least 24 months,
at least 100 weeks, at least INR 18,000*. With no `tierClaims` the demo data claims
higher (36 months / 150 weeks), which is stronger than the slide but not identical to it.
**Decide which you are demoing and rehearse that one**, because a judge with the slide
open will compare the two. The client's band menus default to maximal and let you drop
any dimension.

## Presentation: holder binding and expiry

`/present` used to be `GET /present/:sessionId` and handed the stored proof to anyone who
knew a session id, forever. zk-reference.md names both holes in that one handler: a
Groth16 proof "says nothing about who is holding it," and soulbinding "does not stop
someone forwarding a copy of any data derived from the token; freshness has to come from
a challenge or an expiry."

The flow now:

1. `POST /issue` requires `holderPublicKey` — base64 SPKI, P-256, generated
   **non-extractable** in the rider's browser. The private half cannot be read back out
   by any script on the page and never reaches the operator.
2. `POST /challenge { sessionId }` — the *verifier* opens a check and receives a nonce,
   single-use, expiring in `PRESENTATION_TTL_SECONDS` (default 120). The verifier
   generates it, not the rider: a rider-minted token would prove only that the rider owns
   a clock.
3. The rider signs `GigVault presentation v1\nsession=…\nchallenge=…\nnonce=…\ncommitment=…`
   with that key.
4. `POST /present { sessionId, challengeId, signature }` returns the proof only if the
   challenge exists for that session, is unexpired, is unconsumed, and the signature
   verifies against the registered key. The challenge is burned *before* the proof is
   returned, guarded by `AND consumed_at IS NULL` inside the UPDATE, so two parallel
   requests cannot both win.

`GET /present/:sessionId` now returns `410 PRESENT_REQUIRES_CHALLENGE` rather than being
deleted — a stale client should get a sentence explaining what changed, not a connection
error that reads as "the server is down."

The payload string is a wire format shared between `src/lib/holderKey.ts` and
`public/index.html`. Change it on one side only and every signature fails with nothing but
"invalid" to debug from.

**What this does and does not prove.** It proves the presenter controls the key
registered at issue. It does not prove that key belongs to the human whose Aadhaar was
scanned — that link is the nullifier's job, and it is only as good as Anon Aadhaar being
in real mode (see below). If you move the rider client to an EVM wallet per the deck,
swap the scheme for secp256k1 ecrecover against `ownerOf`; keep the payload construction
identical.

## Windows

- **Do not build inside OneDrive/Dropbox** (`C:\Users\...\OneDrive\...`). Move the repo to
  `C:\dev\gigvault`. Sync clients and `node_modules` corrupt each other.
- `npm run circuit:build` is a Node script — no bash. Download
  `circom-windows-amd64.exe` from the circom GitHub releases, rename it `circom.exe`,
  put it on PATH (or set `$env:CIRCOM="C:\tools\circom.exe"`).
- `.gitattributes` pins `.sh/.circom/.mjs/.cjs` to LF. If you had already checked out
  with CRLF: `git add --renormalize . && git commit -m "lf"`.
- Alternative: do everything in WSL from a WSL path (`~/gigvault`, not `/mnt/c/...`),
  with Node and the Linux circom installed inside WSL. `http://localhost:4000` from a
  Windows browser reaches a server running in WSL.

## Status — 18 Sept, second pass (executed, not asserted)

Everything in this section was run in a sandbox with circom 2.2.3, Node 22, and a local
Hardhat node, and the output was read. Scripts to reproduce each line are named.

**Circuit** — `npm run circuit:build` (backend/): 922 constraints, phase 2, vkey +
`GigVaultVerifier.sol` exported together. The script now generates a 2^12 ptau, not 2^14:
2^14 took 5+ minutes for a circuit that fits in 2^10, and is the first thing that would
have eaten H0.

**Proving** — `npx tsx scripts/prove-test.ts`: cold 1.2 s, warm ~340 ms, verify 41 ms.
Tampered tier signal → false. Over-claim → witness generation fails (no proof exists).
circomlibjs Poseidon matches the circuit.

**Contracts** — compiled and deployed. Two fixes:
- `evmVersion: 'cancun'` in `hardhat.config.ts`. The lockfile pins OpenZeppelin 5.6.1,
  whose `Strings → Bytes.sol` uses `mcopy`; Hardhat's default target for 0.8.24 is
  paris, so `npx hardhat compile` failed on OZ's own files. This would have failed at
  the venue identically. Polygon Amoy supports Cancun.
- `hardhat.offline.config.ts`: compiles with the solc-js already in `node_modules`, no
  download. Use it when the solc download hangs on venue wifi:
  `npx hardhat --config hardhat.offline.config.ts <compile|node|run …>`.

**On chain, with a real proof** — `npx hardhat run scripts/onchain-smoke.ts` (contracts/,
after `npx tsx scripts/export-sample-proof.ts` in backend/): issue, admit → true, forged
commitment → revert, forged tier → false, same nullifier → revert, transfer/approve →
revert, stranger revoke → revert, operator revoke → admit false. All pass.

**Backend ↔ chain (new)** — the backend previously never touched a chain; `/issue` wrote
SQLite only. Now, with `CHAIN_MODE=on` in `backend/.env`:
- `/issue` mints through `GigVaultAdmission.issue()` (which re-verifies the proof on
  chain) and stores `token_id` / `tx_hash`. Pass `holderAddress` (the rider's Privy EVM
  address) to mint to him; omit it and the token is minted to the operator and flagged
  `custodial: true` — say which one you are demoing.
- `/admit` additionally reads on-chain `revoked` and checks the token's commitment still
  matches; either failing → `admitted: false`.
- `/revoke` (new) flips SQLite and, on chain, `Admission.revoke()` (owner-only).
- Addresses come from `deployments/<network>.json`, which `contracts/scripts/deploy.ts`
  now writes. Restart the local node → rerun deploy → file overwritten. Never hand-copy.
- Module: `backend/src/chain/index.ts`. Uses `ethers.NonceManager`; without it two operator
  txs within ~250 ms (issue then revoke) reuse a nonce and fail with NONCE_EXPIRED.

**HTTP end to end** — `node scripts/http-smoke.mjs` against a running server, 17 checks,
all passing in both `CHAIN_MODE=off` and `CHAIN_MODE=on`: consent → fetch → derive
(36 mo / 156 wk / ₹22,918) → issue (real proof; card reads exactly the deck's four lines)
→ challenge → present (holder-signed) → admit true → revoke → admit false; plus replayed
challenge (410), stranger signature (403), nullifier reuse (409), name mismatch (409),
over-claim (422), unknown session (404).

**Anon Aadhaar real mode** — a bug the preflight could not see: `core.verify()` throws
"init has not been called yet" unless `core.init({...})` runs first, and it throws (does
not return false) when the proof's cert doesn't match the mode. `adapters/anonAadhaar.ts`
now inits once, takes `ANON_AADHAAR_USE_TEST` (1 = SDK test cert, for stage demos), is
throw-safe, and reads the nullifier from `pcd.proof.nullifier` — confirmed against the
2.4.3 source, where verify() uses that exact field as public signal [1]. Executed with a
bogus proof → `valid:false`. **Not executed with a real proof** — that needs a QR.
Offline-safe: download `v2.0.0/vkey.json` in advance and set `ANON_AADHAAR_VKEY_PATH`.

**Unit tests** — `npm test`: 16/16.

## Camera and QR (third pass — executed)

Two cameras, pointing opposite ways. Both are in `backend/public/index.html`, with
`jsQR` (decode) and `qrcode` (render) vendored into `public/vendor/` by `npm run vendor`
(runs on install) so there is no CDN dependency. `BarcodeDetector` is used when the
browser has it, jsQR on canvas frames otherwise.

**Entry 2 — rider scans his Aadhaar.** New step "Scan your Aadhaar" between reading the
record and choosing what to show. `public/aadhaar-qr.cjs` decodes the Secure QR on the
device: decimal → bytes → zlib-inflate → 0xff-delimited fields → name, DOB, gender, state,
pincode, photo, and the 256-byte UIDAI signature. Only the name and a one-way identifier
are sent to `/issue`; the name is matched off-circuit against the bank record as before.
- What it is **not**: it does not verify UIDAI's RSA signature and it is not an Anon
  Aadhaar proof. The identifier is `SHA-256(appSeed ‖ photo)` — stable per card,
  unlinkable across apps, and a mock. Real mode still means an Anon Aadhaar proof
  generated on the phone (`ANON_AADHAAR_MODE=real`).
- Proven: `npm test` decodes Anon Aadhaar's public **test** Secure QR fixture
  (`test/fixtures/test-aadhaar-qr.txt`, a test-cert card, not a person) with the same
  file the browser loads. `npm run aadhaar:testqr` renders it to
  `public/vendor/test-aadhaar.png` for a judge to scan off a second screen;
  `node scripts/qr-roundtrip.mjs` proves jsQR reads that PNG back from pixels.

**Entry 4 — verifier scans the passport.** The rider taps "Show QR": `POST /present/ticket`
issues a single-use ticket (120 s), the browser signs
`GigVault qr v1 / session / ticket / commitment` with the non-extractable holder key, and
renders `GV1|session|ticket|signature` — 146 chars, a small QR that scans instantly.
The verifier taps "Scan passport QR": the camera hands the text to `POST /admit/scan`,
which burns the ticket atomically, checks the holder signature, verifies the proof, reads
on-chain revocation and commitment (with `CHAIN_MODE=on`), and answers in ~40 ms with the
four lines or a named refusal. Second scan → `410 QR_ALREADY_USED`; stranger's signature →
`403`; any other QR → `400 QR_UNRECOGNISED`.
- Freshness here is **server-issued expiry + single use**, not a verifier-chosen nonce.
  The `/challenge` + `/present` path (verifier nonce) is unchanged and still the stronger
  one; the QR path is what the deck draws.

**The rule that decides your demo topology.** Browsers allow the camera only on
`http://localhost` or *trusted* https. A phone opening `http://<laptop-ip>:4000` gets no
camera, and a self-signed cert is worse than none. Two layouts that work:
1. Everything on the laptop at `http://localhost:4000`, laptop webcam scanning QRs shown
   on a phone screen (the rider's passport QR, the test Aadhaar PNG). Simplest; rehearse this one.
2. Phone as the rider: expose the laptop over an https tunnel (e.g. `cloudflared tunnel
   --url http://localhost:4000`) and open that URL on the phone. Needs internet.

Smoke: `node scripts/http-smoke.mjs` now runs 23 checks including the QR path.

## Still open — be exact about these on stage

1. **Amoy has never been deployed to** (no internet in the sandbox). `deploy:amoy` is the
   same script; `OPERATOR_PRIVATE_KEY` in backend/.env must be the deployer key.
2. **No real Anon Aadhaar proof has been verified.** Run `npm run check:aadhaar` with
   `ANON_AADHAAR_PROOF_FILE` pointing at a proof you generated yourself.
3. **Selective disclosure exists only at issue time.** The proof is generated once with
   fixed tiers and the salt is discarded, so a rider cannot present a lower tier later.
   Either keep the salt operator-side and re-prove per presentation, or drop the claim.
4. **Custodial minting** unless the client passes `holderAddress`. The holder
   presentation key is P-256 WebCrypto, which is not an EVM address; the deck's "held in
   his own wallet" is only true on chain once Privy's address is passed.
5. **Aadhaar scanning is decode-only.** The camera path decodes the Secure QR and matches the name; it does not verify the UIDAI signature or produce an Anon Aadhaar proof. Say "decoded on device, identity proof pending" — not "Aadhaar verified".
6. `public/index.html` has not been driven in a real browser here: its JS parses and every endpoint it calls passes the smoke test, but the camera UI itself was not clicked. Rehearse both scans once.

## AA sandbox vs mock

`src/adapters/accountAggregator.ts` defines an `AAProvider` interface. The default
bound instance is `MockFIP`, which signs synthetic weekly-credit records on the Setu FI
schema (`src/adapters/setuSchema.ts`) with a local Ed25519 key, structurally identical
to what a real FIU handoff looks like. If your actual AA sandbox credentials are live,
implement `AAProvider` against them (same interface, same return shape) and swap the
binding in `src/adapters/index.ts` — no route code changes.

## Generated-artifact sync

Per your own runbook and zk-reference: `circuit.wasm`, `circuit_final.zkey`,
`verification_key.json`, and `contracts/GigVaultVerifier.sol` are all derived from one
compile. `npm run circuit:build` (in `backend/`) regenerates all four in one script —
see `backend/scripts/build-circuit.sh`. Never hand-edit or partially regenerate any one
of them.

## Layout

```
backend/
  src/
    routes/        consent.ts, fetch.ts, derive.ts, issue.ts, present.ts, admit.ts
    adapters/       accountAggregator.ts, mockFip.ts, setuSchema.ts, anonAadhaar.ts
    zk/             prove.ts, verify.ts (wraps snarkjs)
    db/             schema.sql, index.ts (better-sqlite3)
    lib/            tiers.ts (enumerated thresholds), errors.ts
  circuits/
    gigvault.circom
  scripts/
    build-circuit.sh    circuit -> wasm/zkey -> verification_key.json + Solidity verifier, one script
contracts/
  contracts/GigVaultPassport.sol   ERC-721 + ERC-5192 soulbound
  contracts/GigVaultAdmission.sol  verifies Groth16 proof on-chain, admits true/false
  contracts/GigVaultVerifier.sol   GENERATED — do not hand-edit, see build-circuit.sh
  scripts/deploy.ts
  hardhat.config.ts
```
