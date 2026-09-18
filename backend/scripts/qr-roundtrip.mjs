// Proves the two QRs the demo depends on are decodable by the SAME jsQR the browser
// scanner runs: (1) the passport QR the rider shows, (2) the test Aadhaar Secure QR.
// Renders with `qrcode`, decodes with jsQR from pixels — no camera, same decoder.
import fs from 'node:fs'; import QRCode from 'qrcode'; import { PNG } from 'pngjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const jsQR = require('jsqr'); // same code as public/vendor/jsQR.js (copied from node_modules)
const { decodeAadhaarQr } = require('../public/aadhaar-qr.cjs');

async function decodePng(path) {
  const png = PNG.sync.read(fs.readFileSync(path));
  const t = Date.now();
  const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return { text: r?.data ?? null, ms: Date.now() - t, px: `${png.width}x${png.height}` };
}
const passport = 'GV1|b90369f3-6dff-472c-a847-86611e467935|q5U2s6Y0Z4o7wXyQ|' + 'A'.repeat(88);
await QRCode.toFile('/tmp/passport-qr.png', passport, { errorCorrectionLevel: 'M', scale: 6, margin: 1 });
const p = await decodePng('/tmp/passport-qr.png');
console.log(p.text === passport ? '✓' : '✗', `passport QR round-trip (${p.px}, decode ${p.ms} ms, ${passport.length} chars)`);

const aad = await decodePng(new URL('../public/vendor/test-aadhaar.png', import.meta.url).pathname);
const fixture = fs.readFileSync(new URL('../test/fixtures/test-aadhaar-qr.txt', import.meta.url), 'utf8').trim();
console.log(aad.text === fixture ? '✓' : '✗', `test Aadhaar QR round-trip (${aad.px}, decode ${aad.ms} ms, ${fixture.length} digits)`);
if (aad.text) { const d = await decodeAadhaarQr(aad.text); console.log('✓', `decoded from pixels -> name "${d.name}", nullifier ${d.nullifier.slice(0, 16)}…`); }
