// EIP-191 holder scheme: the rider's EVM wallet signs presentations; server recovers the
// signer and compares to the address the passport was minted to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { verifyHolderSignature, qrPresentationPayload, presentationPayload, assertValidHolderPublicKey } from '../src/lib/holderKey.ts';

const rider = ethers.Wallet.createRandom();
const stranger = ethers.Wallet.createRandom();
const S = 'eip191-secp256k1';
const p = qrPresentationPayload({ sessionId: 's1', ticketId: 't1', commitment: '42' });

test('a genuine EVM presentation verifies', async () => {
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address, payload: p, signatureBase64: await rider.signMessage(p), scheme: S }), true);
});
test('address comparison is case-insensitive (checksummed vs lower)', async () => {
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address.toLowerCase(), payload: p, signatureBase64: await rider.signMessage(p), scheme: S }), true);
});
test('a stranger cannot present the rider passport', async () => {
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address, payload: p, signatureBase64: await stranger.signMessage(p), scheme: S }), false);
});
test('signature is bound to the payload (ticket / commitment)', async () => {
  const sig = await rider.signMessage(p);
  const p2 = qrPresentationPayload({ sessionId: 's1', ticketId: 't2', commitment: '42' });
  const p3 = qrPresentationPayload({ sessionId: 's1', ticketId: 't1', commitment: '43' });
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address, payload: p2, signatureBase64: sig, scheme: S }), false);
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address, payload: p3, signatureBase64: sig, scheme: S }), false);
});
test('challenge payload also works under EIP-191', async () => {
  const c = presentationPayload({ sessionId: 's', challengeId: 'c', nonce: 'n', commitment: '1' });
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address, payload: c, signatureBase64: await rider.signMessage(c), scheme: S }), true);
});
test('garbage fails closed', () => {
  assert.equal(verifyHolderSignature({ spkiBase64: rider.address, payload: p, signatureBase64: 'nope', scheme: S }), false);
  assert.equal(verifyHolderSignature({ spkiBase64: 'not-an-address', payload: p, signatureBase64: '0x00', scheme: S }), false);
});
test('issue-time validation: address required for the EVM scheme, P-256 key rejected under it', () => {
  assertValidHolderPublicKey(rider.address, S);
  assert.throws(() => assertValidHolderPublicKey('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE', S));
  assert.throws(() => assertValidHolderPublicKey(rider.address, 'ecdsa-p256-sha256'));
});
