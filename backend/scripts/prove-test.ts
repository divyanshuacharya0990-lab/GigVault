import { issueProof, verifyProofLocally } from '../src/zk/prove.ts';
const figs = { tenureMonths: 36, weeksPaid: 156, monthlyIncome: 21000 };
let t = Date.now();
const p1 = await issueProof(figs);                     // max tiers
console.log('cold prove ms', Date.now() - t, 'tiers', p1.tierClaims, 'pub', p1.publicSignals);
t = Date.now();
const p2 = await issueProof(figs, { tenureTierIdx: 3, weeksTierIdx: 3, incomeTierIdx: 3 }); // deck card
console.log('warm prove ms', Date.now() - t, 'tiers', p2.tierClaims);
t = Date.now();
console.log('verify p1', await verifyProofLocally(p1.proof, p1.publicSignals), 'ms', Date.now() - t);
console.log('verify p2', await verifyProofLocally(p2.proof, p2.publicSignals));
// tamper: swap tier claim in public signals
const tampered = [...p2.publicSignals]; tampered[3] = '4';
console.log('tampered tier verify (must be false)', await verifyProofLocally(p2.proof, tampered));
// over-claim: income tier 4 needs >= 25000
try { await issueProof(figs, { incomeTierIdx: 4 }); console.log('OVERCLAIM PROVED — BUG'); }
catch (e: any) { console.log('overclaim rejected by witness calc:', String(e.message).slice(0, 80)); }
process.exit(0);
