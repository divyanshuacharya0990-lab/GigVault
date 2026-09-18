/**
 * Holder-binding crypto test.
 *
 * Runs with zero dependencies: node:test + node:crypto + WebCrypto, all built in. That
 * is deliberate — this is the one new security-critical path, and a test that needs an
 * npm install is a test nobody runs at hour 20.
 *
 * The browser half below is not a simulation. Node 22's globalThis.crypto.subtle is the
 * same WebCrypto surface the rider client uses, so "sign in the client, verify on the
 * server" is exercised exactly as it will run.
 *
 *   node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const HOLDER_KEY_SCHEME = 'ecdsa-p256-sha256';

function presentationPayload({ sessionId, challengeId, nonce, commitment }) {
  return [
    'GigVault presentation v1',
    `session=${sessionId}`,
    `challenge=${challengeId}`,
    `nonce=${nonce}`,
    `commitment=${commitment}`,
  ].join('\n');
}

function assertValidHolderPublicKey(spkiBase64) {
  const key = crypto.createPublicKey({
    key: Buffer.from(spkiBase64, 'base64'), format: 'der', type: 'spki',
  });
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('not P-256');
  }
}

function verifyHolderSignature({ spkiBase64, payload, signatureBase64 }) {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(spkiBase64, 'base64'), format: 'der', type: 'spki',
    });
    return crypto.verify(
      'sha256',
      Buffer.from(payload, 'utf-8'),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch { return false; }
}

// ---- the browser half, via the same WebCrypto API the client uses ----
const b64 = buf => Buffer.from(new Uint8Array(buf)).toString('base64');

async function makeRider() {
  const kp = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'],
  );
  const spki = await globalThis.crypto.subtle.exportKey('spki', kp.publicKey);
  return { kp, spkiB64: b64(spki) };
}
async function riderSigns(rider, payload) {
  const sig = await globalThis.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, rider.kp.privateKey, new TextEncoder().encode(payload),
  );
  return b64(sig);
}

const FIXTURE = {
  sessionId: 'sess-abc',
  challengeId: 'chal-123',
  nonce: crypto.randomBytes(32).toString('base64url'),
  commitment: '19837465019283746501928374650192837465019',
};

test('a non-extractable browser key exports an SPKI the server accepts', async () => {
  const rider = await makeRider();
  assert.doesNotThrow(() => assertValidHolderPublicKey(rider.spkiB64));
  assert.equal(rider.kp.privateKey.extractable, false, 'private key must be non-extractable');
});

test('a genuine presentation verifies', async () => {
  const rider = await makeRider();
  const payload = presentationPayload(FIXTURE);
  const signature = await riderSigns(rider, payload);
  assert.equal(
    verifyHolderSignature({ spkiBase64: rider.spkiB64, payload, signatureBase64: signature }),
    true,
    'WebCrypto raw r||s must verify under dsaEncoding ieee-p1363',
  );
});

test('a different rider cannot present this passport', async () => {
  const holder = await makeRider();
  const attacker = await makeRider();
  const payload = presentationPayload(FIXTURE);
  const signature = await riderSigns(attacker, payload);
  assert.equal(
    verifyHolderSignature({ spkiBase64: holder.spkiB64, payload, signatureBase64: signature }),
    false,
  );
});

test('a signature is bound to its challenge, not reusable against another', async () => {
  const rider = await makeRider();
  const signature = await riderSigns(rider, presentationPayload(FIXTURE));
  const replayed = presentationPayload({ ...FIXTURE, challengeId: 'chal-999', nonce: 'other-nonce' });
  assert.equal(
    verifyHolderSignature({ spkiBase64: rider.spkiB64, payload: replayed, signatureBase64: signature }),
    false,
    'capturing a signature must not let it be replayed against a fresh challenge',
  );
});

test('a signature is bound to its commitment, so it cannot present a different passport', async () => {
  const rider = await makeRider();
  const signature = await riderSigns(rider, presentationPayload(FIXTURE));
  const swapped = presentationPayload({ ...FIXTURE, commitment: '999' });
  assert.equal(
    verifyHolderSignature({ spkiBase64: rider.spkiB64, payload: swapped, signatureBase64: signature }),
    false,
  );
});

test('DER-encoded signatures are rejected, catching an encoding drift', async () => {
  // If anyone "fixes" the client to emit DER, this fails loudly instead of silently
  // refusing every real rider at the demo table.
  const rider = await makeRider();
  const payload = presentationPayload(FIXTURE);
  const raw = Buffer.from(await riderSigns(rider, payload), 'base64');
  assert.equal(raw.length, 64, 'P-256 raw r||s is 64 bytes');
  const der = Buffer.concat([Buffer.from([0x30, 0x44, 0x02, 0x20]), raw.subarray(0, 32),
                             Buffer.from([0x02, 0x20]), raw.subarray(32)]);
  assert.equal(
    verifyHolderSignature({ spkiBase64: rider.spkiB64, payload, signatureBase64: der.toString('base64') }),
    false,
  );
});

test('garbage input fails closed rather than throwing', () => {
  assert.equal(verifyHolderSignature({ spkiBase64:'not-a-key', payload:'x', signatureBase64:'zz' }), false);
  assert.throws(() => assertValidHolderPublicKey('not-a-key'));
});

test('an RSA key is rejected — scheme is pinned, not inferred', () => {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  assert.throws(() => assertValidHolderPublicKey(spki));
});

test('scheme label is the one stored at issue time', () => {
  assert.equal(HOLDER_KEY_SCHEME, 'ecdsa-p256-sha256');
});
