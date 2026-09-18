/**
 * Aadhaar Secure QR decoder — runs unchanged in the browser and in Node 22.
 *
 * The Secure QR (mAadhaar / e-Aadhaar PDF) is one big decimal integer. Decoded:
 *   bigint -> big-endian bytes -> zlib-inflate -> "V2" 0xff field 0xff field ... 0xff
 *   photo(JPEG) ... [last 256 bytes: RSA-2048 signature by UIDAI]
 * Field order (after the "V2" tag): indicator, referenceId, name, dob, gender, careOf,
 * district, landmark, house, location, pincode, postOffice, state, street,
 * subDistrict, vtc, phoneLast4. Photo starts after the 18th delimiter.
 *
 * What this file does NOT do: verify UIDAI's signature or produce an Anon Aadhaar
 * proof. In mock mode the nullifier below is SHA-256(appSeed || photo bytes) — stable
 * per card, unlinkable across apps with different seeds, and NOT a proof of anything.
 * Real mode replaces it with the nullifier from a verified Anon Aadhaar proof.
 * Everything here stays on the device; only `name` and the nullifier leave it.
 */
(function (root) {
  const FIELDS = ['indicator', 'referenceId', 'name', 'dob', 'gender', 'careOf', 'district', 'landmark',
    'house', 'location', 'pincode', 'postOffice', 'state', 'street', 'subDistrict', 'vtc', 'phoneLast4'];

  function bigDecimalToBytes(decimal) {
    if (!/^\d{100,}$/.test(decimal)) throw new Error('Not an Aadhaar Secure QR (expected a long decimal string)');
    let n = BigInt(decimal); const out = [];
    while (n > 0n) { out.push(Number(n & 255n)); n >>= 8n; }
    return new Uint8Array(out.reverse());
  }

  async function inflate(bytes) {
    const fmt = bytes[0] === 0x1f && bytes[1] === 0x8b ? 'gzip' : 'deflate'; // deflate = zlib-wrapped
    const ds = new DecompressionStream(fmt);
    const w = ds.writable.getWriter(); w.write(bytes); w.close();
    const chunks = []; const r = ds.readable.getReader();
    for (;;) { const { value, done } = await r.read(); if (done) break; chunks.push(value); }
    const len = chunks.reduce((a, c) => a + c.length, 0); const out = new Uint8Array(len);
    let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  async function sha256Hex(bytes) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** @returns {Promise<{name, dob, gender, pincode, state, referenceLast4, photoBytes, signature, nullifier, version}>} */
  async function decodeAadhaarQr(qrText, opts) {
    const seed = (opts && opts.nullifierSeed) || 'gigvault-demo-seed';
    const bytes = bigDecimalToBytes(String(qrText).trim());
    const data = await inflate(bytes);
    if (data.length < 300) throw new Error('Decompressed QR too short');
    const signature = data.subarray(data.length - 256);
    const body = data.subarray(0, data.length - 256);

    // split first 18 delimiters; everything after the 18th is the photo
    const fields = []; let start = 0; let photoStart = -1;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === 0xff) {
        fields.push(new TextDecoder('latin1').decode(body.subarray(start, i)));
        start = i + 1;
        if (fields.length === 18) { photoStart = start; break; }
      }
    }
    if (fields.length < 4) throw new Error('Unrecognised Aadhaar QR layout');
    const version = fields[0] === 'V2' || fields[0] === 'V3' ? fields.shift() : 'V1';
    const rec = {}; FIELDS.forEach((k, i) => { rec[k] = fields[i] ?? ''; });
    const photoBytes = photoStart >= 0 ? body.subarray(photoStart) : new Uint8Array(0);

    const seedBytes = new TextEncoder().encode(seed);
    const joined = new Uint8Array(seedBytes.length + photoBytes.length);
    joined.set(seedBytes, 0); joined.set(photoBytes, seedBytes.length);
    const nullifier = 'mock-' + (await sha256Hex(joined)).slice(0, 40);

    return {
      version, name: rec.name, dob: rec.dob, gender: rec.gender, pincode: rec.pincode, state: rec.state,
      referenceLast4: rec.referenceId.slice(0, 4), photoBytes, signature, nullifier,
    };
  }

  const api = { decodeAadhaarQr, bigDecimalToBytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AadhaarQR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
