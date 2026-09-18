import { ethers, network } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Deploys GigVaultVerifier (must already be the GENERATED one from build-circuit.sh —
 * this script does not check that for you), GigVaultPassport, and GigVaultAdmission,
 * then wires the passport's admissionContract to the deployed Admission address.
 *
 * Per hackathon-runbook.md: local chains reset on restart, wiping addresses. Re-run
 * this script after every `hardhat node` restart — do not reuse addresses printed from
 * a previous run.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const Verifier = await ethers.getContractFactory('GigVaultVerifier');
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log('GigVaultVerifier deployed to:', verifierAddress);

  const Passport = await ethers.getContractFactory('GigVaultPassport');
  const passport = await Passport.deploy();
  await passport.waitForDeployment();
  const passportAddress = await passport.getAddress();
  console.log('GigVaultPassport deployed to:', passportAddress);

  const Admission = await ethers.getContractFactory('GigVaultAdmission');
  const admission = await Admission.deploy(verifierAddress, passportAddress);
  await admission.waitForDeployment();
  const admissionAddress = await admission.getAddress();
  console.log('GigVaultAdmission deployed to:', admissionAddress);

  const tx = await passport.setAdmissionContract(admissionAddress);
  await tx.wait();
  console.log('GigVaultPassport.admissionContract set to Admission address.');

  // Written, not copied: backend/src/chain/index.ts reads deployments/<network>.json.
  // A restarted local chain => rerun this script => file overwritten. No stale addresses.
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const out = { network: network.name, chainId, verifierAddress, passportAddress, admissionAddress, deployer: deployer.address, deployedAt: new Date().toISOString() };
  const dir = path.resolve(__dirname, '..', '..', 'deployments');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('\n--- wrote', file, '---');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
