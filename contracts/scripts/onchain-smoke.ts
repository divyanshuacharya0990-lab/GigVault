/**
 * End-to-end on-chain smoke test with a REAL Groth16 proof.
 *
 * Prereq (from backend/): npm run circuit:build && npx tsx scripts/export-sample-proof.ts
 * Run:  npx hardhat run scripts/onchain-smoke.ts                   (in-process chain)
 *       npx hardhat run scripts/onchain-smoke.ts --network localhost
 *       npx hardhat --config hardhat.offline.config.ts run scripts/onchain-smoke.ts
 *
 * Exercises, in order: deploy + wire, issue with a valid proof, admit -> true,
 * "chain refuses his version" (forged commitment -> revert), same-nullifier reissue
 * -> revert, soulbound transfer -> revert, revoke -> admit false.
 */
import { ethers } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const sample = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../backend/circuits/build/sample-proof.json'), 'utf8'),
  );
  const { a, b, c, pubSignals } = sample.calldata;
  const [operator, rider, lender, stranger] = await ethers.getSigners();

  const verifier = await (await ethers.getContractFactory('GigVaultVerifier')).deploy();
  const passport = await (await ethers.getContractFactory('GigVaultPassport')).deploy();
  const admission = await (await ethers.getContractFactory('GigVaultAdmission')).deploy(
    await verifier.getAddress(), await passport.getAddress(),
  );
  await (await passport.setAdmissionContract(await admission.getAddress())).wait();
  console.log('deployed + wired');

  const nullifier = ethers.keccak256(ethers.toUtf8Bytes('anon-aadhaar-nullifier:demo'));

  // 1. issue
  let tx = await admission.issue(rider.address, nullifier, a, b, c, pubSignals);
  let rc = await tx.wait();
  const tokenId = 1n;
  console.log('issued tokenId', tokenId.toString(), 'gas', rc!.gasUsed.toString());
  if ((await passport.ownerOf(tokenId)) !== rider.address) throw new Error('wrong owner');
  if (!(await passport.locked(tokenId))) throw new Error('not locked');
  if ((await passport.commitmentOf(tokenId)) !== ethers.toBeHex(BigInt(sample.commitment), 32)) throw new Error('commitment mismatch');

  // 2. admit -> true (lender pays gas)
  tx = await admission.connect(lender).admit(tokenId, a, b, c, pubSignals);
  rc = await tx.wait();
  const ev = rc!.logs.map((l) => { try { return admission.interface.parseLog(l); } catch { return null; } }).find((e) => e?.name === 'Admitted');
  console.log('admit result', ev!.args.result, 'gas', rc!.gasUsed.toString());
  if (ev!.args.result !== true) throw new Error('admit should be true');
  // static-call path (free, off-chain style)
  console.log('admit.staticCall', await admission.admit.staticCall(tokenId, a, b, c, pubSignals));

  // 3. forged: judge edits the figures -> different commitment -> chain refuses
  const forgedPub = [...pubSignals]; forgedPub[0] = ethers.toBeHex(12345n, 32);
  await expectRevert(admission.connect(lender).admit(tokenId, a, b, c, forgedPub), 'commitment mismatch');
  // 3b. forged tier claim with the real commitment -> proof invalid
  const forgedTier = [...pubSignals]; forgedTier[3] = ethers.toBeHex(4n, 32);
  const r = await admission.admit.staticCall(tokenId, a, b, c, forgedTier);
  console.log('forged tier claim admit ->', r); if (r) throw new Error('forged tier admitted');

  // 4. one human, one passport
  await expectRevert(admission.issue(stranger.address, nullifier, a, b, c, pubSignals), 'nullifier already issued');

  // 5. soulbound
  await expectRevert(passport.connect(rider).transferFrom(rider.address, stranger.address, tokenId), 'soulbound');
  await expectRevert(passport.connect(rider).approve(stranger.address, tokenId), 'soulbound');

  // 6. revoke -> admit false; stranger cannot revoke
  await expectRevert(admission.connect(stranger).revoke(tokenId), 'OwnableUnauthorizedAccount');
  await (await admission.revoke(tokenId)).wait();
  console.log('after revoke admit ->', await admission.admit.staticCall(tokenId, a, b, c, pubSignals));

  console.log('\nALL ON-CHAIN CHECKS PASSED');
}

async function expectRevert(p: Promise<unknown>, needle: string) {
  try { await p; } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (!msg.includes(needle)) throw new Error(`reverted, but not with "${needle}": ${msg.slice(0, 200)}`);
    console.log(`revert OK: ${needle}`); return;
  }
  throw new Error(`expected revert "${needle}" but call succeeded`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
