/**
 * Generates one real Groth16 proof for the deck's demo figures and writes it, together
 * with its Solidity calldata, to circuits/build/sample-proof.json. Used by
 * contracts/scripts/onchain-smoke.ts to exercise issue()/admit() on a chain.
 * Run from backend/:  npx tsx scripts/export-sample-proof.ts
 */
import * as snarkjs from 'snarkjs';
import fs from 'node:fs';
import { issueProof, verifyProofLocally } from '../src/zk/prove.js';

const figures = { tenureMonths: 36, weeksPaid: 156, monthlyIncome: 21000, payerNameHash: 0n }; // demo record
const tiers = { tenureTierIdx: 3, weeksTierIdx: 3, incomeTierIdx: 3 };       // the deck's card
const t0 = Date.now();
const issued = await issueProof(figures, tiers);
const proveMs = Date.now() - t0;
if (!(await verifyProofLocally(issued.proof, issued.publicSignals))) throw new Error('self-verify failed');

const calldata = await snarkjs.groth16.exportSolidityCallData(issued.proof as any, issued.publicSignals);
const argv = JSON.parse('[' + calldata + ']');
const out = {
  figures, tierClaims: issued.tierClaims, commitment: issued.commitment,
  publicSignals: issued.publicSignals, proof: issued.proof,
  calldata: { a: argv[0], b: argv[1], c: argv[2], pubSignals: argv[3] },
  proveMs,
};
fs.writeFileSync('circuits/build/sample-proof.json', JSON.stringify(out, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
console.log(`wrote circuits/build/sample-proof.json (prove ${proveMs} ms)`);
process.exit(0);
