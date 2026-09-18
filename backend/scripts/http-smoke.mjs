/**
 * Full HTTP smoke test against a RUNNING server (default http://localhost:4000).
 * Drives the exact demo path: consent -> fetch -> derive -> issue (real Groth16 proof)
 * -> challenge -> present (holder-signed) -> admit, then every refusal a judge could
 * ask for. Zero deps: node:crypto + fetch.
 *
 *   npm run dev            (terminal 1)
 *   node scripts/http-smoke.mjs   (terminal 2)
 */
import { webcrypto as wc, createHash } from 'node:crypto';
import { ethers } from 'ethers';
const BASE = process.env.GIGVAULT_URL ?? 'http://localhost:4000';
const b64 = (buf) => Buffer.from(buf).toString('base64');
let failures = 0;
const ok = (cond, label, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`); if (!cond) failures++; };
async function call(method, path, body) {
  const t = Date.now();
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json, ms: Date.now() - t };
}
async function holderKey() {
  const kp = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const spki = await wc.subtle.exportKey('spki', kp.publicKey);
  return { kp, publicKey: b64(spki) };
}
const sign = async (kp, payload) => kp.wallet ? kp.wallet.signMessage(payload) : b64(await wc.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(payload, 'utf8')));
const payloadFor = ({ sessionId, challengeId, nonce, commitment }) =>
  ['GigVault presentation v1', `session=${sessionId}`, `challenge=${challengeId}`, `nonce=${nonce}`, `commitment=${commitment}`].join('\n');

// ---------- happy path ----------
const h = await call('GET', '/health'); ok(h.status === 200, 'health');
const consent = await call('POST', '/consent', { customerIdentifier: 'ramesh@demo' });
ok(consent.status === 201, 'consent', `session=${consent.json?.sessionId}`);
const { sessionId } = consent.json; const consentId = consent.json.consent?.consentId ?? consent.json.consent?.id;
const fetched = await call('POST', '/fetch', { sessionId, consentId });
ok(fetched.status === 200 || fetched.status === 201, 'fetch (signed FI envelope)', JSON.stringify(fetched.json).slice(0, 120));
const derived = await call('POST', '/derive', { sessionId });
ok(derived.status === 200 || derived.status === 201, 'derive', JSON.stringify(derived.json?.derived));
// The rider's wallet (what Privy's embedded wallet would provide): minted-to address == signing key.
const riderWallet = ethers.Wallet.createRandom();
const kp = { wallet: riderWallet }; const publicKey = riderWallet.address;
const nullifier = 'nullifier-' + sessionId.slice(0, 8);
const otherNullifier = 'nullifier-other-' + sessionId.slice(0, 8); // unique per run: SQLite remembers old ones
const issue = await call('POST', '/issue', { sessionId, holderPublicKey: publicKey, holderKeyScheme: 'eip191-secp256k1',
  anonAadhaar: { nullifier, proof: {}, publicSignals: [], decodedName: 'Ramesh  Kumar' },
  tierClaims: { tenureTierIdx: 3, weeksTierIdx: 3, incomeTierIdx: 2 } });
ok(issue.status === 201, `issue (real Groth16 proof, ${issue.ms} ms)`, issue.status === 201 ? JSON.stringify(issue.json?.card) : `${issue.status} ${JSON.stringify(issue.json)}`);
const commitment = issue.json?.commitment;
const ch = await call('POST', '/challenge', { sessionId, verifierLabel: 'Platform B' });
ok(ch.status === 201, 'challenge issued by verifier');
const sig = await sign(kp, payloadFor({ sessionId, challengeId: ch.json.challengeId, nonce: ch.json.nonce, commitment }));
const pres = await call('POST', '/present', { sessionId, challengeId: ch.json.challengeId, signature: sig });
ok(pres.status === 200, `present (holder-signed, ${pres.ms} ms)`, `signals=${JSON.stringify(pres.json?.publicSignals ?? pres.json?.proof?.publicSignals ?? '').slice(0, 60)}`);
const admit = await call('POST', '/admit', { sessionId, verifierLabel: 'Platform B' });
ok(admit.status === 200 && admit.json?.admitted === true, `admit -> ${admit.json?.admitted} (${admit.ms} ms)`, admit.json?.chain ? `on-chain: token #${admit.json.chain.tokenId} revoked=${admit.json.chain.revoked} commitmentMatches=${admit.json.chain.commitmentMatches}` : 'no on-chain record (CHAIN_MODE=off, or the mint failed — see the issue line)');
if (issue.json?.chain) {
  ok(issue.json.chain.tokenId && issue.json.chain.txHash, 'minted on chain', `token #${issue.json.chain.tokenId} tx=${issue.json.chain.txHash.slice(0, 12)}… holder=${issue.json.chain.holder.slice(0, 8)}… custodial=${issue.json.chain.custodial}`);
  ok(issue.json.chain.holder.toLowerCase() === riderWallet.address.toLowerCase() && issue.json.chain.custodial === false, "token owner is the rider's own wallet, not the operator", `ownerOf == ${riderWallet.address.slice(0, 8)}…`);
}

// ---------- refusals ----------
const replay = await call('POST', '/present', { sessionId, challengeId: ch.json.challengeId, signature: sig });
ok(replay.json?.error === 'CHALLENGE_ALREADY_USED', 'replayed challenge refused', `${replay.status} ${replay.json?.error}`);
const ch2 = await call('POST', '/challenge', { sessionId });
const strangerKp = { wallet: ethers.Wallet.createRandom() };
const badSig = await sign(strangerKp, payloadFor({ sessionId, challengeId: ch2.json.challengeId, nonce: ch2.json.nonce, commitment }));
const forged = await call('POST', '/present', { sessionId, challengeId: ch2.json.challengeId, signature: badSig });
ok(forged.json?.error === 'HOLDER_SIGNATURE_INVALID', 'someone else presenting his passport refused', `${forged.status} ${forged.json?.error}`);

// second human, same nullifier -> one human, one passport
const c2 = await call('POST', '/consent', { customerIdentifier: 'imposter@demo' });
await call('POST', '/fetch', { sessionId: c2.json.sessionId, consentId: c2.json.consent?.consentId ?? c2.json.consent?.id });
await call('POST', '/derive', { sessionId: c2.json.sessionId });
const reuse = await call('POST', '/issue', { sessionId: c2.json.sessionId, holderPublicKey: publicKey, holderKeyScheme: 'eip191-secp256k1',
  anonAadhaar: { nullifier, proof: {}, publicSignals: [], decodedName: 'RAMESH KUMAR' } });
ok(reuse.json?.error === 'NULLIFIER_REUSED', 'same Aadhaar nullifier, second passport refused', `${reuse.status} ${reuse.json?.error}`);
// wrong name vs bank record
const wrongName = await call('POST', '/issue', { sessionId: c2.json.sessionId, holderPublicKey: publicKey, holderKeyScheme: 'eip191-secp256k1',
  anonAadhaar: { nullifier: otherNullifier, proof: {}, publicSignals: [], decodedName: 'SURESH KUMAR' } });
ok(wrongName.json?.error === 'NAME_MISMATCH', 'Aadhaar name != bank name refused', `${wrongName.status} ${wrongName.json?.error}`);
// over-claim: income tier 4 needs >= 25,000
const over = await call('POST', '/issue', { sessionId: c2.json.sessionId, holderPublicKey: publicKey, holderKeyScheme: 'eip191-secp256k1',
  anonAadhaar: { nullifier: otherNullifier, proof: {}, publicSignals: [], decodedName: 'RAMESH KUMAR' },
  tierClaims: { incomeTierIdx: 4 } });
ok(over.json?.error === 'TIER_CLAIM_TOO_HIGH', 'claiming a tier the figures do not clear refused', `${over.status} ${over.json?.error}`);
// unissued session
const unissued = await call('POST', '/admit', { sessionId: 'no-such-session' });
ok(unissued.status === 404 || unissued.json?.admitted === false, 'admit on unknown session', `${unissued.status} ${unissued.json?.error ?? ''}`);

// ---------- QR path: rider shows a signed single-use QR, verifier's camera hands it over ----------
const tk = await call('POST', '/present/ticket', { sessionId });
ok(tk.status === 201, 'present/ticket');
const qrPayload = ['GigVault qr v1', `session=${sessionId}`, `ticket=${tk.json.ticketId}`, `commitment=${commitment}`].join('\n');
const qrText = `GV1|${sessionId}|${tk.json.ticketId}|${await sign(kp, qrPayload)}`;
const scan = await call('POST', '/admit/scan', { qr: qrText, verifierLabel: 'camera' });
ok(scan.status === 200 && scan.json?.admitted === true, `admit/scan -> ${scan.json?.admitted} (${scan.json?.ms} ms server, QR ${qrText.length} chars)`, JSON.stringify(scan.json?.card) + (scan.json?.holder?.ownsToken === true ? ' · presenter owns the token on chain' : scan.json?.holder ? ` · holder ${JSON.stringify(scan.json.holder)}` : ''));
const rescan = await call('POST', '/admit/scan', { qr: qrText });
ok(rescan.status === 410, 'same QR scanned twice refused', `${rescan.status} ${rescan.json?.error}`);
const tk2 = await call('POST', '/present/ticket', { sessionId });
const forgedQr = `GV1|${sessionId}|${tk2.json.ticketId}|${await sign(strangerKp, ['GigVault qr v1', `session=${sessionId}`, `ticket=${tk2.json.ticketId}`, `commitment=${commitment}`].join('\n'))}`;
const fscan = await call('POST', '/admit/scan', { qr: forgedQr });
ok(fscan.status === 403, 'QR signed by a stranger refused', `${fscan.status} ${fscan.json?.error}`);
const junk = await call('POST', '/admit/scan', { qr: 'https://example.com/not-a-passport' });
ok(junk.status === 400, 'non-GigVault QR refused', `${junk.status} ${junk.json?.error}`);
const vend = await fetch(BASE + '/vendor/jsQR.js'); const dec = await fetch(BASE + '/aadhaar-qr.js'); const page = await fetch(BASE + '/');
ok(vend.status === 200 && dec.status === 200 && page.status === 200, 'client + vendored libs served');

// revoke -> admit false
const rev = await call('POST', '/revoke', { sessionId, reason: 'consent withdrawn' });
ok(rev.status === 200 && rev.json?.revoked === true, 'revoke', rev.json?.chain ? `on-chain tx=${rev.json.chain.txHash.slice(0, 12)}…` : `${rev.status} ${JSON.stringify(rev.json)}`);
const after = await call('POST', '/admit', { sessionId });
ok(after.json?.admitted === false, 'admit after revoke -> false', after.json?.chain ? `on-chain revoked=${after.json.chain.revoked}` : '');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL HTTP CHECKS PASSED');
process.exit(failures ? 1 : 0);
