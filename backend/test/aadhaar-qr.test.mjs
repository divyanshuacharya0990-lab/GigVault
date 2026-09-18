// Decodes the Anon Aadhaar project's public TEST Secure QR (signed with their test cert,
// not a real person) with the same file the browser loads. Zero deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { decodeAadhaarQr } = require('../public/aadhaar-qr.cjs');
const qr = fs.readFileSync(new URL('./fixtures/test-aadhaar-qr.txt', import.meta.url), 'utf8').trim();

test('decodes name, fields, photo and signature from a Secure QR', async () => {
  const r = await decodeAadhaarQr(qr);
  assert.equal(r.version, 'V2');
  assert.equal(r.name, 'Sumit Kumar');
  assert.equal(r.dob, '01-01-1984');
  assert.equal(r.gender, 'M');
  assert.equal(r.pincode, '110051');
  assert.equal(r.state, 'Delhi');
  assert.equal(r.signature.length, 256);
  assert.ok(r.photoBytes.length > 500, 'photo present');
  assert.equal(r.photoBytes[0], 0xff, 'photo is JPEG');
});
test('nullifier is stable per card and differs per app seed', async () => {
  const a = await decodeAadhaarQr(qr, { nullifierSeed: 'app-A' });
  const b = await decodeAadhaarQr(qr, { nullifierSeed: 'app-A' });
  const c = await decodeAadhaarQr(qr, { nullifierSeed: 'app-B' });
  assert.equal(a.nullifier, b.nullifier);
  assert.notEqual(a.nullifier, c.nullifier);
});
test('rejects junk', async () => {
  await assert.rejects(decodeAadhaarQr('GV1|abc|def|ghi'));
  await assert.rejects(decodeAadhaarQr('1234'));
});
