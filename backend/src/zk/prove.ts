import * as snarkjs from 'snarkjs';
import path from 'node:path';
import fs from 'node:fs';
import { computeCommitment, randomFieldSalt } from './poseidon.js';
import { tenureTierIndex, weeksTierIndex, incomeTierIndex } from '../lib/tiers.js';
import { AppError } from '../lib/errors.js';

/**
 * THE ARCHITECTURAL CORRECTION THIS FILE ENCODES:
 *
 * Proving happens here, server-side, exactly once, inside /issue — immediately after
 * the operator derives tenureMonths/weeksPaid/monthlyIncome from the AA fetch. The
 * salt and raw figures are generated and consumed entirely within this process; they
 * are never serialized to the rider's phone, never returned in any API response, and
 * never logged.
 *
 * Why: if the phone generated this proof instead, the operator would have to ship it
 * the plaintext tenure/weeks/income and the salt so the phone could prove knowledge of
 * them — which quietly turns this into Level 3 ("rider proves over their own data")
 * while the deck still claims Level 1 ("the arithmetic is still ours"). That
 * claim/implementation mismatch is exactly the kind of thing the deck's own trust
 * table exists to prevent. Keeping proving server-side is what makes "Level 1" true
 * rather than aspirational.
 *
 * The ONE proof that legitimately belongs on the phone is the Anon Aadhaar identity
 * proof (src/adapters/anonAadhaar.ts client-side counterpart) — because the entire
 * point of that scheme is that the Aadhaar number never reaches any server. That
 * asymmetry — income proof server-side, identity proof phone-side — is intentional,
 * not inconsistent.
 */

interface DerivedFigures {
  tenureMonths: number;
  weeksPaid: number;
  monthlyIncome: number;
  payerNameHash: bigint;
}

export interface IssuedProof {
  proof: unknown;
  publicSignals: string[];
  commitment: string; // decimal string field element
  tierClaims: {
    tenureTierIdx: number;
    weeksTierIdx: number;
    incomeTierIdx: number;
  };
}

function wasmPath(): string {
  return process.env.CIRCUIT_WASM_PATH ?? path.resolve('circuits/build/gigvault_js/gigvault.wasm');
}
function zkeyPath(): string {
  return process.env.CIRCUIT_ZKEY_PATH ?? path.resolve('circuits/build/gigvault_final.zkey');
}

/**
 * Generates the one and only Groth16 proof for a session's derived figures. Called
 * from src/routes/issue.ts and nowhere else in this codebase — grep for callers before
 * adding a second one; this is a deliberate single-call-site design so "proving
 * happens exactly once, server-side" stays true by construction, not just by
 * convention.
 */
/**
 * Checked explicitly (rather than letting fullProve throw its own opaque error) so
 * "circuit not built yet" surfaces as a clean, named error instead of the generic
 * INTERNAL_ERROR the global handler falls back to. Per the runbook's debugging
 * discipline: get one fact, don't guess — this is that fact, handed to the caller
 * up front instead of buried three layers into a snarkjs stack trace.
 */
function assertCircuitArtifactsExist(): void {
  const missing: string[] = [];
  if (!fs.existsSync(wasmPath())) missing.push(wasmPath());
  if (!fs.existsSync(zkeyPath())) missing.push(zkeyPath());
  if (missing.length > 0) {
    throw new AppError(
      503,
      'CIRCUIT_NOT_BUILT',
      `Circuit artifacts not found: ${missing.join(', ')}. Run "npm run circuit:build" ` +
        'in backend/ (requires the circom compiler on PATH) before calling /issue.',
    );
  }
}

/**
 * `requestedTiers` implements downward-only selective disclosure. Omit it (the default)
 * and the rider claims the highest tier each figure clears. Supply it — after validating
 * with isClaimableTier() at the API boundary, as routes/issue.ts does — and the rider
 * discloses less. There is no path here that can claim *more*: even if this function
 * were handed an inflated index, the circuit's `value >= boundary[claimedIdx]`
 * constraint means no satisfying witness exists and fullProve fails. The API check is
 * for error quality, not for soundness; soundness lives in the circuit.
 */
export async function issueProof(
  figures: DerivedFigures,
  requestedTiers?: Partial<IssuedProof['tierClaims']>,
): Promise<IssuedProof> {
  assertCircuitArtifactsExist();
  const salt = randomFieldSalt();
  const tenureMonths = BigInt(figures.tenureMonths);
  const weeksPaid = BigInt(figures.weeksPaid);
  const monthlyIncome = BigInt(figures.monthlyIncome);
  const payerNameHash = figures.payerNameHash;

  const commitment = await computeCommitment({
    tenureMonths,
    weeksPaid,
    monthlyIncome,
    payerNameHash,
    salt,
  });

  const tierClaims = {
    tenureTierIdx: requestedTiers?.tenureTierIdx ?? tenureTierIndex(figures.tenureMonths),
    weeksTierIdx: requestedTiers?.weeksTierIdx ?? weeksTierIndex(figures.weeksPaid),
    incomeTierIdx: requestedTiers?.incomeTierIdx ?? incomeTierIndex(figures.monthlyIncome),
  };

  const input = {
    tenureMonths: tenureMonths.toString(),
    weeksPaid: weeksPaid.toString(),
    monthlyIncome: monthlyIncome.toString(),
    payerNameHash: payerNameHash.toString(),
    salt: salt.toString(),
    commitment: commitment.toString(),
    tenureTierIdx: tierClaims.tenureTierIdx.toString(),
    weeksTierIdx: tierClaims.weeksTierIdx.toString(),
    incomeTierIdx: tierClaims.incomeTierIdx.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath(), zkeyPath());

  // salt is intentionally dropped here — nothing downstream of this function ever
  // sees it again. It lived only in this function's local scope.
  return {
    proof,
    publicSignals,
    commitment: commitment.toString(),
    tierClaims,
  };
}

export async function verifyProofLocally(
  proof: unknown,
  publicSignals: string[],
): Promise<boolean> {
  const vkeyPath = process.env.CIRCUIT_VKEY_PATH ?? path.resolve('circuits/build/verification_key.json');
  if (!fs.existsSync(vkeyPath)) {
    throw new AppError(
      503,
      'CIRCUIT_NOT_BUILT',
      `Verification key not found at ${vkeyPath}. Run "npm run circuit:build" in backend/ first.`,
    );
  }
  const fsp = await import('node:fs/promises');
  const vkey = JSON.parse(await fsp.readFile(vkeyPath, 'utf-8'));
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}
