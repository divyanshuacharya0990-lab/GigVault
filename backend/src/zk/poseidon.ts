import { buildPoseidon } from 'circomlibjs';

let poseidonInstance: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Computes the same Poseidon(4) commitment the circuit enforces:
 * commitment = Poseidon(tenureMonths, weeksPaid, monthlyIncome, salt)
 *
 * Field elements cross this boundary as decimal strings — per zk-reference.md,
 * mixing JS `Number` in silently loses precision above 2^53. Everything here is
 * BigInt or decimal-string until it needs to be a JS number for control flow only
 * (e.g. tier lookups in lib/tiers.ts, which operate on the pre-field-element rupee/
 * month/week values, not the commitment itself).
 */
export async function computeCommitment(input: {
  tenureMonths: bigint;
  weeksPaid: bigint;
  monthlyIncome: bigint;
  payerNameHash: bigint;
  salt: bigint;
}): Promise<bigint> {
  const poseidon = await getPoseidon();
  const hash = poseidon([
    input.tenureMonths,
    input.weeksPaid,
    input.monthlyIncome,
    input.payerNameHash,
    input.salt,
  ]);
  return BigInt(poseidon.F.toString(hash));
}

export function randomFieldSalt(): bigint {
  // 31 bytes keeps us comfortably under the BN254 scalar field size.
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return BigInt(hex);
}

import * as cryptoNode from 'node:crypto';

// BN254 scalar field size
const SNARK_FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

export function computePayerNameHash(payers: string[]): bigint {
  if (payers.length === 0) return 0n;
  const sorted = [...payers].sort();
  const joined = sorted.join('|');
  const hash = cryptoNode.createHash('sha256').update(joined).digest('hex');
  return BigInt('0x' + hash) % SNARK_FIELD_SIZE;
}

