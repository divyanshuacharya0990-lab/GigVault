// Renders the public TEST Aadhaar Secure QR (Anon Aadhaar's fixture, signed with their
// test certificate — not a real person) to public/vendor/test-aadhaar.png so a judge can
// scan it off a second screen or a printout.  npm run aadhaar:testqr
import fs from 'node:fs'; import QRCode from 'qrcode';
const qr = fs.readFileSync(new URL('../test/fixtures/test-aadhaar-qr.txt', import.meta.url), 'utf8').trim();
await QRCode.toFile(new URL('../public/vendor/test-aadhaar.png', import.meta.url).pathname, [{ data: qr, mode: 'numeric' }], { errorCorrectionLevel: 'L', scale: 4, margin: 2 });
console.log('wrote public/vendor/test-aadhaar.png  (open http://localhost:4000/vendor/test-aadhaar.png)');
