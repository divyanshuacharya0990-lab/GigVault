// Copies the two browser libs the client needs into public/vendor so the demo has no
// CDN dependency. Runs on postinstall; committed output is fine to keep.
import fs from 'node:fs'; import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, '..', 'public', 'vendor'); fs.mkdirSync(out, { recursive: true });
import { execSync } from 'node:child_process';
fs.copyFileSync(path.join(here, '..', 'node_modules/jsqr/dist/jsQR.js'), path.join(out, 'jsQR.js'));
fs.copyFileSync(path.join(here, '..', 'node_modules/ethers/dist/ethers.umd.min.js'), path.join(out, 'ethers.umd.min.js'));
// qrcode 1.5 ships no browser bundle; esbuild (already present via tsx) makes one.
execSync('npx esbuild node_modules/qrcode/lib/browser.js --bundle --format=iife --global-name=QRCode --minify --outfile=public/vendor/qrcode.js', { cwd: path.join(here, '..'), stdio: 'inherit' });
console.log('vendor: client libs copied to public/vendor');
