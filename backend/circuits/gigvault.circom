pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * GigVault commitment circuit.
 *
 * Private inputs: the operator-derived figures and a random salt.
 * Public inputs: the Poseidon commitment (so a verifier can bind the proof to a
 * specific on-chain-recorded commitment) and the three claimed tier indices.
 *
 * What this proves: "I know (tenureMonths, weeksPaid, monthlyIncome, salt) that hash
 * to this public commitment, AND those values clear the thresholds for the claimed
 * tier indices." It does NOT prove the values came from a bank — that's the AA-signed
 * envelope published alongside the commitment (see README, Level 1). It does NOT prove
 * an Aadhaar name match — that's off-circuit (see adapters/anonAadhaar.ts). This
 * circuit's ONLY job is: commitment integrity + threshold correctness.
 *
 * Tier boundaries below mirror backend/src/lib/tiers.ts and are set so the demo
 * reproduces the submitted deck's card (>=24 months, >=100 weeks, >=INR 18,000)
 * exactly. If you change the
 * boundaries in tiers.ts, you MUST change them here too and rerun
 * `npm run circuit:build` — see the artifact-sync warning in zk-reference.md. There is
 * no mechanism in this repo that keeps them in sync automatically; that's a deliberate
 * scope cut, not an oversight, for a 36-hour build.
 */

template GigVaultCommitment() {
    // ---- private inputs ----
    signal input tenureMonths;
    signal input weeksPaid;
    signal input monthlyIncome;
    signal input salt;

    // ---- public inputs ----
    signal input commitment;
    signal input tenureTierIdx;   // 0..4, indexes TENURE_TIERS_MONTHS
    signal input weeksTierIdx;    // 0..4, indexes WEEKS_TIERS
    signal input incomeTierIdx;   // 0..4, indexes INCOME_TIERS_INR
    signal input payerNameHash;

    // ---- 1. commitment integrity ----
    component hasher = Poseidon(5);
    hasher.inputs[0] <== tenureMonths;
    hasher.inputs[1] <== weeksPaid;
    hasher.inputs[2] <== monthlyIncome;
    hasher.inputs[3] <== payerNameHash;
    hasher.inputs[4] <== salt;
    commitment === hasher.out;

    // ---- 2. enumerated tier tables (mirrors backend/src/lib/tiers.ts) ----
    // Fixed-size, hardcoded boundaries — deliberately NOT a verifier-supplied
    // threshold. See zk-reference.md "Choosing what is public" on why a free-form
    // threshold leaks via repeated binary-search queries.
    var TENURE_B[5] = [0, 6, 12, 24, 36];
    var WEEKS_B[5]  = [0, 26, 52, 100, 150];
    var INCOME_B[5] = [0, 10000, 15000, 18000, 25000];

    // For each dimension: value must be >= boundary[claimedTierIdx], enforced by
    // selecting the boundary via an equality-gated sum (avoids variable circuit
    // indexing while staying fully constrained for all 5 possible tier claims).
    component tenureEq[5];
    signal tenureSelBoundary[5];
    signal tenureTermAccum[6];
    tenureTermAccum[0] <== 0;
    for (var i = 0; i < 5; i++) {
        tenureEq[i] = IsEqual();
        tenureEq[i].in[0] <== tenureTierIdx;
        tenureEq[i].in[1] <== i;
        tenureSelBoundary[i] <== tenureEq[i].out * TENURE_B[i];
        tenureTermAccum[i+1] <== tenureTermAccum[i] + tenureSelBoundary[i];
    }
    // SOUNDNESS: exactly one tier must have matched. Without this, an
    // out-of-range tenureTierIdx (e.g. 9) makes every IsEqual output 0, the
    // selected boundary sum 0, and the >= check below pass trivially.
    signal tenureEqSum;
    tenureEqSum <== tenureEq[0].out + tenureEq[1].out + tenureEq[2].out + tenureEq[3].out + tenureEq[4].out;
    tenureEqSum === 1;

    component tenureGeAll = GreaterEqThan(32);
    tenureGeAll.in[0] <== tenureMonths;
    tenureGeAll.in[1] <== tenureTermAccum[5];
    tenureGeAll.out === 1;

    component weeksEq[5];
    signal weeksSelBoundary[5];
    signal weeksTermAccum[6];
    weeksTermAccum[0] <== 0;
    for (var j = 0; j < 5; j++) {
        weeksEq[j] = IsEqual();
        weeksEq[j].in[0] <== weeksTierIdx;
        weeksEq[j].in[1] <== j;
        weeksSelBoundary[j] <== weeksEq[j].out * WEEKS_B[j];
        weeksTermAccum[j+1] <== weeksTermAccum[j] + weeksSelBoundary[j];
    }
    // SOUNDNESS: exactly one tier must have matched. Without this, an
    // out-of-range weeksTierIdx (e.g. 9) makes every IsEqual output 0, the
    // selected boundary sum 0, and the >= check below pass trivially.
    signal weeksEqSum;
    weeksEqSum <== weeksEq[0].out + weeksEq[1].out + weeksEq[2].out + weeksEq[3].out + weeksEq[4].out;
    weeksEqSum === 1;

    component weeksGeAll = GreaterEqThan(32);
    weeksGeAll.in[0] <== weeksPaid;
    weeksGeAll.in[1] <== weeksTermAccum[5];
    weeksGeAll.out === 1;

    component incomeEq[5];
    signal incomeSelBoundary[5];
    signal incomeTermAccum[6];
    incomeTermAccum[0] <== 0;
    for (var k = 0; k < 5; k++) {
        incomeEq[k] = IsEqual();
        incomeEq[k].in[0] <== incomeTierIdx;
        incomeEq[k].in[1] <== k;
        incomeSelBoundary[k] <== incomeEq[k].out * INCOME_B[k];
        incomeTermAccum[k+1] <== incomeTermAccum[k] + incomeSelBoundary[k];
    }
    // GAP: this enforces monthlyIncome >= the CLAIMED tier's floor, which is the
    // correct constraint — a prover cannot claim a higher tier than their real income
    // supports. What is NOT yet added: an upper-bound check against the next tier, so
    // a rider with income far above tier 4 still just claims tier 4 (intended — tiers
    // are floors, "at least this band," matching the deck's "≥" framing throughout).
    // If your underwriting partner wants exact-band claims rather than floors, add a
    // LessThan constraint against the next boundary here and re-run circuit:build.
    // SOUNDNESS: exactly one tier must have matched. Without this, an
    // out-of-range incomeTierIdx (e.g. 9) makes every IsEqual output 0, the
    // selected boundary sum 0, and the >= check below pass trivially.
    signal incomeEqSum;
    incomeEqSum <== incomeEq[0].out + incomeEq[1].out + incomeEq[2].out + incomeEq[3].out + incomeEq[4].out;
    incomeEqSum === 1;

    component incomeGeAll = GreaterEqThan(32);
    incomeGeAll.in[0] <== monthlyIncome;
    incomeGeAll.in[1] <== incomeTermAccum[5];
    incomeGeAll.out === 1;
}

component main {public [commitment, tenureTierIdx, weeksTierIdx, incomeTierIdx, payerNameHash]} = GigVaultCommitment();
