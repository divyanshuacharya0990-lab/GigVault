/**
 * Anon Aadhaar identity binding.
 *
 * What the stock Anon Aadhaar circuit actually proves: possession of a validly-signed
 * Aadhaar Secure QR, exposing a nullifier (one human → one stable pseudonymous id) and,
 * optionally, revealed fields the circuit supports: ageAbove18, gender, state, pincode.
 * It does NOT match or reveal the name in-circuit — that field isn't part of the
 * public nullifier scheme. The deck's Entry 2 ("name matched to the bank's") is
 * therefore implemented here as an off-circuit check, not a circuit constraint. Say
 * that distinction on stage; see README "What Level 1 actually means."
 *
 * Flow:
 *  1. Rider's phone verifies the Aadhaar Secure QR signature locally (UIDAI's public
 *     cert, offline — no UIDAI registration or AUA/Sub-AUA licence needed for this;
 *     that licence path is only required for online e-KYC, which this build doesn't
 *     use) and decodes the QR payload, including the name field, client-side.
 *  2. Phone submits { nullifier, anonAadhaarProof, decodedName } to /issue.
 *  3. This module verifies the Anon Aadhaar proof (nullifier binding) and the caller
 *     (issue.ts) separately compares decodedName against the AA-fetched bank
 *     account-holder name — plain string comparison, off-circuit, logged either way.
 */

import { AppError } from '../lib/errors.js';

export interface AnonAadhaarProofInput {
  nullifier: string;
  // The actual Groth16 proof + public signals from @anon-aadhaar/core, opaque here.
  proof: unknown;
  publicSignals: unknown;
}

export interface AnonAadhaarVerificationResult {
  valid: boolean;
  nullifier: string;
}

/**
 * Two modes, selected by ANON_AADHAAR_MODE (default "mock").
 *
 * mock — structural check only, returns valid. Fine for wiring the pipeline and for a
 *        stage demo where no real Aadhaar QR is scanned. Refuses to run if NODE_ENV is
 *        "production", because the failure mode of shipping this by accident is
 *        "anyone can mint a passport as anyone".
 *
 * real — dynamically imports @anon-aadhaar/core and verifies the proof properly.
 *
 * THE SECURITY FIX THIS FUNCTION ENCODES: the nullifier returned is taken from the
 * *verified proof's public signals*, never from the caller's request body. The previous
 * version echoed back `input.nullifier` as given — which meant "one human, one
 * passport" could be bypassed by sending a different string, since the uniqueness check
 * in routes/issue.ts keys on exactly this return value. A nullifier that the caller
 * chooses is not a nullifier. In mock mode the caller's value is still used (there is
 * no proof to extract from), which is precisely why mock mode is barred from
 * production.
 */
export async function verifyAnonAadhaarProof(
  input: AnonAadhaarProofInput,
): Promise<AnonAadhaarVerificationResult> {
  if (!input.nullifier || typeof input.nullifier !== 'string') {
    return { valid: false, nullifier: input.nullifier ?? '' };
  }

  const mode = process.env.ANON_AADHAAR_MODE ?? 'mock';

  if (mode !== 'real') {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        500,
        'AADHAAR_MOCK_IN_PRODUCTION',
        'ANON_AADHAAR_MODE is not "real" but NODE_ENV is "production". Refusing to ' +
          'accept a mock identity proof in a production process.',
      );
    }
    // Structural check only — deliberately not an identity check. See doc comment.
    return { valid: true, nullifier: input.nullifier };
  }

  // ---- real verification ----
  const core = await loadCore();

  // Test-Aadhaar mode: the SDK ships a test UIDAI certificate so a demo can run without
  // scanning a real card. The proof's pubkeyHash must match the mode, or verify() THROWS
  // (it does not return false) — hence the try/catch below.
  const useTestAadhaar = (process.env.ANON_AADHAAR_USE_TEST ?? '1') !== '0';

  let isValid = false;
  try {
    isValid = (await core.verify(input.proof, useTestAadhaar)) === true;
  } catch (err) {
    // pubkey mismatch (real card in test mode or vice versa), malformed proof, etc.
    // All of these are "not a valid identity proof", not server faults.
    return { valid: false, nullifier: '' };
  }
  if (!isValid) {
    return { valid: false, nullifier: '' };
  }

  // Extract the nullifier from the VERIFIED proof, never from the request body.
  // @anon-aadhaar/core v2.4.x: verify() checks pcd.proof.nullifier as public signal [1],
  // so pcd.proof.nullifier is the authoritative location (executed against 2.4.3).
  const extracted = (input.proof as any)?.proof?.nullifier;

  if (extracted === undefined || extracted === null) {
    throw new AppError(
      500,
      'NULLIFIER_NOT_EXTRACTABLE',
      'Anon Aadhaar proof verified but no nullifier could be read from it. Refusing to ' +
        'fall back to the caller-supplied nullifier — that would let a caller choose ' +
        'their own identity. Fix the field path in adapters/anonAadhaar.ts.',
    );
  }

  return { valid: true, nullifier: String(extracted) };
}

/**
 * @anon-aadhaar/core requires init() before verify(): getVerifyKey() reads
 * initArgs.vkeyURL and throws "init has not been called yet" otherwise. This was the
 * bug the preflight script could not see (it only checked that verify is a function).
 *
 * Artifacts: by default the v2.0.0 vkey is fetched from Anon Aadhaar's S3 bucket ON
 * FIRST VERIFY — that needs internet at the venue. To be offline-safe, download
 * vkey.json in advance and set ANON_AADHAAR_VKEY_PATH=/abs/path/vkey.json; the SDK then
 * require()s it locally. (wasm/zkey are only needed for PROVING, which happens on the
 * rider's phone, not here.)
 */
let corePromise: Promise<any> | null = null;
async function loadCore(): Promise<any> {
  if (corePromise) return corePromise;
  corePromise = (async () => {
    let core: any;
    try {
      // `as any` on the specifier stops TS type-checking their shipped .ts sources
      // against this project's separately-installed snarkjs. Same runtime import.
      core = await import(('@anon-aadhaar/core') as any);
    } catch {
      throw new AppError(
        503,
        'ANON_AADHAAR_NOT_INSTALLED',
        'ANON_AADHAAR_MODE=real but @anon-aadhaar/core is not installed. Run ' +
          '"npm install @anon-aadhaar/core" in backend/, or set ANON_AADHAAR_MODE=mock ' +
          'for a demo without a real Aadhaar QR.',
      );
    }
    if (typeof core.verify !== 'function' || typeof core.init !== 'function') {
      throw new AppError(
        500,
        'ANON_AADHAAR_API_MISMATCH',
        'The installed @anon-aadhaar/core does not export init()/verify(). This adapter ' +
          'was executed against 2.4.3; check your version.',
      );
    }
    const localVkey = process.env.ANON_AADHAAR_VKEY_PATH;
    const base = 'https://anon-aadhaar-artifacts.s3.eu-central-1.amazonaws.com/v2.0.0';
    await core.init({
      wasmURL: process.env.ANON_AADHAAR_WASM_URL ?? `${base}/aadhaar-verifier.wasm`,
      zkeyURL: process.env.ANON_AADHAAR_ZKEY_URL ?? `${base}/circuit_final.zkey`,
      vkeyURL: localVkey ?? `${base}/vkey.json`,
      artifactsOrigin: localVkey ? core.ArtifactsOrigin.local : core.ArtifactsOrigin.server,
    });
    return core;
  })();
  return corePromise;
}

/**
 * Off-circuit name match. Deliberately simple and deliberately logged — this is the
 * exact claim boundary the deck needs to be honest about on stage. Case/whitespace
 * normalised; not fuzzy-matched, because silently accepting near-matches on an
 * identity check is a worse failure mode than asking the rider to rescan.
 */
export function namesMatch(qrDecodedName: string, bankAccountHolderName: string): boolean {
  const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  return norm(qrDecodedName) === norm(bankAccountHolderName);
}
