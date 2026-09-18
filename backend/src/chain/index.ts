/**
 * Entry 3 — ISSUE: "a hash on chain, in a token nobody can sell or seize."
 *
 * This module is the ONLY place the backend talks to a chain. It is off unless
 * CHAIN_MODE=on, so the SQLite-only demo keeps working with zero chain setup; with it
 * on, /issue mints the soulbound passport through GigVaultAdmission.issue() (which
 * re-verifies the Groth16 proof on-chain), /admit additionally checks the on-chain
 * revocation flag and that the stored commitment still matches, and /revoke flips the
 * flag on-chain.
 *
 * Addresses come from ../deployments/<CHAIN_NETWORK>.json, written by
 * contracts/scripts/deploy.ts — never hand-copied, because a local chain resets and
 * stale addresses fail in ways that look like logic bugs (hackathon-runbook.md).
 *
 * Holder address: the deck's rider wallet is Privy (EVM). If /issue is given a
 * holderAddress the token is minted to it. If not, it is minted to the OPERATOR's own
 * address and flagged custodial=true — the passport exists on chain and every
 * refusal still works, but "held in his own wallet" is not yet true for that token.
 * Say which one you are demoing.
 */
import { ethers } from 'ethers';
import * as snarkjs from 'snarkjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '../lib/errors.js';

const ADMISSION_ABI = [
  'function issue(address holder, bytes32 nullifierCommitment, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[5] publicSignals) returns (uint256)',
  'function admit(uint256 tokenId, uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[5] publicSignals) returns (bool)',
  'function revoke(uint256 tokenId)',
  'function nullifierUsed(bytes32) view returns (bool)',
  'event Issued(uint256 indexed tokenId, address indexed holder, bytes32 commitment)',
];
const PASSPORT_ABI = [
  'function ownerOf(uint256) view returns (address)',
  'function commitmentOf(uint256) view returns (bytes32)',
  'function revoked(uint256) view returns (bool)',
  'function locked(uint256) view returns (bool)',
];

export interface ChainDeployment { network: string; chainId: number; verifierAddress: string; passportAddress: string; admissionAddress: string; }

export function chainEnabled(): boolean {
  return (process.env.CHAIN_MODE ?? 'off') === 'on';
}

function deploymentFile(): string {
  if (process.env.CHAIN_DEPLOYMENT_FILE) return process.env.CHAIN_DEPLOYMENT_FILE;
  const net = process.env.CHAIN_NETWORK ?? 'localhost';
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deployments', `${net}.json`);
}

let cached: { provider: ethers.JsonRpcProvider; operator: ethers.Wallet; admission: ethers.Contract; passport: ethers.Contract; dep: ChainDeployment } | null = null;

function connect() {
  if (cached) return cached;
  const file = deploymentFile();
  if (!fs.existsSync(file)) {
    throw new AppError(503, 'CHAIN_NOT_DEPLOYED',
      `CHAIN_MODE=on but no deployment file at ${file}. Run "npm run deploy:local" (or deploy:amoy) in contracts/ — it writes this file. ` +
      'A restarted local chain needs a fresh deploy.');
  }
  const dep = JSON.parse(fs.readFileSync(file, 'utf8')) as ChainDeployment;
  const rpc = process.env.CHAIN_RPC_URL ?? 'http://127.0.0.1:8545';
  const pk = process.env.OPERATOR_PRIVATE_KEY ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // hardhat account #0
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
  const operator = new ethers.Wallet(pk, provider);
  // NonceManager: ethers caches eth_getTransactionCount briefly, so two operator txs
  // within ~250 ms (e.g. /issue then /revoke in a demo click-through) reuse a nonce and
  // fail with NONCE_EXPIRED. The manager tracks the nonce locally instead.
  const signer = new ethers.NonceManager(operator);
  cached = {
    provider, operator, dep,
    admission: new ethers.Contract(dep.admissionAddress, ADMISSION_ABI, signer),
    passport: new ethers.Contract(dep.passportAddress, PASSPORT_ABI, provider),
  };
  return cached;
}

export function operatorAddress(): string { return connect().operator.address; }

async function calldata(proof: unknown, publicSignals: string[]) {
  const s = await snarkjs.groth16.exportSolidityCallData(proof as any, publicSignals);
  const [a, b, c, pub] = JSON.parse('[' + s + ']');
  return { a, b, c, pub };
}

/** Nullifier goes on chain hashed — the raw Anon Aadhaar nullifier is stable across
 *  this app and would otherwise be a public join key on the explorer. */
export const nullifierCommitment = (nullifier: string) => ethers.keccak256(ethers.toUtf8Bytes(`gigvault:v1:${nullifier}`));

export async function issueOnChain(args: { holderAddress?: string; nullifier: string; proof: unknown; publicSignals: string[] }) {
  const { admission, operator, dep } = connect();
  const holder = args.holderAddress ?? operator.address;
  if (!ethers.isAddress(holder)) throw new AppError(400, 'BAD_HOLDER_ADDRESS', `holderAddress ${holder} is not an EVM address`);
  const { a, b, c, pub } = await calldata(args.proof, args.publicSignals);
  const nc = nullifierCommitment(args.nullifier);
  if (await admission.nullifierUsed(nc)) throw new AppError(409, 'NULLIFIER_REUSED', 'This Aadhaar nullifier already issued a passport on chain.');
  let receipt: ethers.TransactionReceipt;
  try {
    const tx = await admission.issue(holder, nc, a, b, c, pub);
    receipt = await tx.wait();
  } catch (e: any) {
    throw new AppError(502, 'CHAIN_ISSUE_FAILED', `admission.issue reverted or failed: ${String(e?.shortMessage ?? e?.message ?? e).slice(0, 200)}`);
  }
  const ev = receipt.logs.map((l) => { try { return admission.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === 'Issued');
  if (!ev) throw new AppError(502, 'CHAIN_ISSUE_FAILED', 'issue tx mined but no Issued event found');
  return { tokenId: ev.args.tokenId.toString(), txHash: receipt.hash, holder, custodial: !args.holderAddress, network: dep.network, chainId: dep.chainId, passportAddress: dep.passportAddress };
}

export async function onChainStatus(tokenId: string, expectedCommitmentDecimal: string) {
  const { passport } = connect();
  const [revoked, commitment, owner, locked] = await Promise.all([
    passport.revoked(tokenId), passport.commitmentOf(tokenId), passport.ownerOf(tokenId), passport.locked(tokenId),
  ]);
  const matches = BigInt(commitment) === BigInt(expectedCommitmentDecimal);
  return { tokenId, revoked: Boolean(revoked), commitmentMatches: matches, owner: String(owner), locked: Boolean(locked) };
}

export async function revokeOnChain(tokenId: string) {
  const { admission } = connect();
  try {
    const tx = await admission.revoke(tokenId);
    const r = await tx.wait();
    return { txHash: r.hash };
  } catch (e: any) {
    throw new AppError(502, 'CHAIN_REVOKE_FAILED', `admission.revoke failed: ${String(e?.shortMessage ?? e?.message ?? e).slice(0, 200)}`);
  }
}
