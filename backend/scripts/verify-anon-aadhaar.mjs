/**
 * Anon Aadhaar preflight.
 *
 *   node scripts/verify-anon-aadhaar.mjs
 *
 * WHY THIS EXISTS. The real-mode path in src/adapters/anonAadhaar.ts has never been
 * executed. It was written against @anon-aadhaar/core's documented surface, in a
 * sandbox with no network, so the package could not be installed and the code could not
 * be run even once. Two things in it are therefore guesses: that the module exports
 * `verify`, and where the nullifier sits on a verified proof.
 *
 * This script does not make those guesses true. It tells you, in about two seconds on a
 * machine that has the package, whether they are — and if they are not, exactly which
 * line to change. That is the difference between finding out here and finding out when
 * a judge scans a real Aadhaar QR.
 *
 * It does NOT verify a real proof: that needs an actual Aadhaar Secure QR, which is
 * personal data that has no business in a test fixture. Pass one with
 * ANON_AADHAAR_PROOF_FILE=<path to a JSON proof> if you have generated one yourself.
 */

const FAIL = [];
const WARN = [];
const OK = [];

const say = (icon, msg) => console.log(`${icon} ${msg}`);

let core;
try {
  core = await import('@anon-aadhaar/core');
  OK.push('@anon-aadhaar/core is installed and imports cleanly.');
} catch (err) {
  say('✗', '@anon-aadhaar/core is not installed.');
  console.log('\n  Fix:  npm install @anon-aadhaar/core');
  console.log('  Until then, leave ANON_AADHAAR_MODE unset (defaults to mock).');
  console.log('  Mock mode is NOT an identity check — it accepts any caller.\n');
  process.exit(1);
}

// ---- 1. the export the adapter calls ----
if (typeof core.verify === 'function' && typeof core.init === 'function') {
  OK.push('core.verify() and core.init() exist — the adapter calls init() once, then verify().');
} else {
  FAIL.push(
    'core.verify() does NOT exist in your installed version.\n' +
    `      Exports found: ${Object.keys(core).slice(0, 25).join(', ') || '(none)'}\n` +
    '      Fix: adapters/anonAadhaar.ts calls core.verify(input.proof). Find the\n' +
    '      equivalent in your version and change that one call. The adapter already\n' +
    '      throws ANON_AADHAAR_API_MISMATCH rather than failing open, so the server\n' +
    '      will refuse to issue until you do.',
  );
}

// ---- 2. the nullifier field path ----
const proofFile = process.env.ANON_AADHAAR_PROOF_FILE;
if (!proofFile) {
  WARN.push(
    'No ANON_AADHAAR_PROOF_FILE given, so the nullifier field path is UNVERIFIED.\n' +
    '      The adapter reads, in order: proof.proof.nullifier, proof.nullifier,\n' +
    '      publicSignals[0] — and fails closed if none resolve.\n' +
    '      To check it properly: generate a proof with your own Aadhaar QR, save it as\n' +
    '      JSON, then re-run with ANON_AADHAAR_PROOF_FILE=./that-file.json',
  );
} else {
  const { readFile } = await import('node:fs/promises');
  try {
    const proof = JSON.parse(await readFile(proofFile, 'utf-8'));
    const candidates = {
      'proof.proof.nullifier': proof?.proof?.nullifier,
      'proof.nullifier': proof?.nullifier,
      'publicSignals[0]': Array.isArray(proof?.publicSignals) ? proof.publicSignals[0] : undefined,
    };
    const hit = Object.entries(candidates).find(([, v]) => v !== undefined && v !== null);
    if (hit) {
      OK.push(`Nullifier resolves via ${hit[0]}.`);
    } else {
      FAIL.push(
        'No nullifier could be read from that proof by any path the adapter tries.\n' +
        `      Top-level keys: ${Object.keys(proof).join(', ')}\n` +
        '      Fix: add the correct path to the `extracted` chain in\n' +
        '      adapters/anonAadhaar.ts. Do NOT fall back to the caller-supplied\n' +
        '      nullifier — a nullifier the caller chooses is not a nullifier, and that\n' +
        '      bypass is exactly what the fail-closed branch exists to prevent.',
      );
    }

    if (typeof core.verify === 'function') {
      const result = await core.verify(proof);
      const isValid = result === true || result?.isValid === true;
      if (isValid) OK.push('core.verify() accepted the supplied proof.');
      else FAIL.push('core.verify() REJECTED the supplied proof. Check it was generated for the same circuit/version.');
    }
  } catch (err) {
    FAIL.push(`Could not read or verify ${proofFile}: ${err.message}`);
  }
}

// ---- 3. the foot-gun ----
if ((process.env.ANON_AADHAAR_MODE ?? 'mock') !== 'real') {
  WARN.push(
    'ANON_AADHAAR_MODE is not "real", so the server is still accepting mock identities.\n' +
    '      Set ANON_AADHAAR_MODE=real in backend/.env once the two checks above pass.',
  );
}

console.log('');
OK.forEach(m => say('✓', m));
WARN.forEach(m => say('!', m));
FAIL.forEach(m => say('✗', m));
console.log('');

if (FAIL.length) {
  say('✗', `${FAIL.length} blocking problem(s). Real-mode identity binding will not work yet.`);
  process.exit(1);
}
if (WARN.length) {
  say('!', 'No blocking problems, but the checks above are incomplete. Do not claim');
  say(' ', 'Aadhaar verification is proven until the nullifier path is confirmed.');
  process.exit(0);
}
say('✓', 'Real-mode Anon Aadhaar verification checks out against your installed package.');
