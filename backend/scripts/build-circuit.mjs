#!/usr/bin/env node
/**
 * Cross-platform circuit build (Windows PowerShell, WSL, macOS, Linux) — no bash.
 * Same steps as build-circuit.sh, regenerating the WHOLE artifact set together:
 *   circom -> r1cs/wasm/sym -> (phase 1 ptau, cached) -> phase 2 zkey
 *   -> verification_key.json + ../contracts/contracts/GigVaultVerifier.sol
 *
 * Needs the circom compiler:
 *   Windows: download circom-windows-amd64.exe from https://github.com/iden3/circom/releases,
 *            rename to circom.exe, put it on PATH — or set CIRCOM=C:\path\to\circom.exe
 *   Linux/WSL/mac: circom-linux-amd64 / circom-macos-amd64 likewise (chmod +x).
 * snarkjs runs from node_modules via this same Node, so it never depends on the shell.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(backend);
const BUILD = 'circuits/build', PTAU = 'circuits/ptau', NAME = 'gigvault';
const VERIFIER = path.join('..', 'contracts', 'contracts', 'GigVaultVerifier.sol');
const SNARKJS = path.join('node_modules', 'snarkjs', 'build', 'cli.cjs');
const CIRCOM = process.env.CIRCOM || 'circom';
fs.mkdirSync(BUILD, { recursive: true }); fs.mkdirSync(PTAU, { recursive: true });

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], shell: false });
  if (r.error || r.status !== 0) {
    console.error(`\n✗ ${label} failed (${cmd} ${args.join(' ')})`);
    if (r.error?.code === 'ENOENT') console.error(`  "${cmd}" not found. See the header of scripts/build-circuit.mjs for install steps, or set CIRCOM=<full path>.`);
    process.exit(1);
  }
}
const snark = (args, label) => run(process.execPath, [SNARKJS, ...args], label);
const entropy = () => randomBytes(32).toString('hex');

console.log('== 1/5 compile circuit');
run(CIRCOM, [`circuits/${NAME}.circom`, '--r1cs', '--wasm', '--sym', '-o', BUILD, '-l', 'node_modules/circomlib/circuits', '-l', 'node_modules'], 'circom');
snark(['r1cs', 'info', `${BUILD}/${NAME}.r1cs`], 'r1cs info');

console.log('== 2/5 phase 1 (2^12 ptau, cached; ~1 min first time; dev-only, not a public ceremony)');
const ptauFinal = `${PTAU}/pot12_final.ptau`;
if (!fs.existsSync(ptauFinal)) {
  snark(['powersoftau', 'new', 'bn128', '12', `${PTAU}/pot12_0000.ptau`], 'ptau new');
  snark(['powersoftau', 'contribute', `${PTAU}/pot12_0000.ptau`, `${PTAU}/pot12_0001.ptau`, '--name=gigvault', `-e=${entropy()}`], 'ptau contribute');
  snark(['powersoftau', 'prepare', 'phase2', `${PTAU}/pot12_0001.ptau`, ptauFinal], 'ptau prepare phase2');
} else console.log(`   reusing ${ptauFinal}`);

console.log('== 3/5 phase 2 (circuit-specific — rerun on ANY circuit change)');
snark(['groth16', 'setup', `${BUILD}/${NAME}.r1cs`, ptauFinal, `${BUILD}/${NAME}_0000.zkey`], 'groth16 setup');
snark(['zkey', 'contribute', `${BUILD}/${NAME}_0000.zkey`, `${BUILD}/${NAME}_final.zkey`, '--name=gigvault', `-e=${entropy()}`], 'zkey contribute');

console.log('== 4/5 export vkey + Solidity verifier (both, together, always)');
snark(['zkey', 'export', 'verificationkey', `${BUILD}/${NAME}_final.zkey`, `${BUILD}/verification_key.json`], 'export vkey');
snark(['zkey', 'export', 'solidityverifier', `${BUILD}/${NAME}_final.zkey`, VERIFIER], 'export verifier');
let sol = fs.readFileSync(VERIFIER, 'utf8');
if (sol.includes('contract Groth16Verifier')) { sol = sol.replace('contract Groth16Verifier', 'contract GigVaultVerifier'); fs.writeFileSync(VERIFIER, sol); console.log('   renamed Groth16Verifier -> GigVaultVerifier'); }
if (!/uint\[5\] (calldata |memory )?_pubSignals/.test(sol)) console.warn('WARNING: verifier does not take uint[5] _pubSignals — GigVaultAdmission.sol expects 5 public signals.');

console.log('== 5/5 artifact set fingerprint');
const fp = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const set = { zkey: fp(`${BUILD}/${NAME}_final.zkey`), vkey: fp(`${BUILD}/verification_key.json`), verifierSol: fp(VERIFIER), builtAt: new Date().toISOString() };
fs.writeFileSync(`${BUILD}/ARTIFACT_SET.json`, JSON.stringify(set, null, 2));
console.log(set);
console.log('\nDone. Next: cd ../contracts && npx hardhat compile && npx hardhat run scripts/deploy.ts --network localhost');
