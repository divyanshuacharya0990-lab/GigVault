/**
 * Enumerated tier tables.
 *
 * zk-reference.md is explicit about why this has to be a fixed, small set rather than
 * a verifier-chosen threshold at query time: a verifier free to ask arbitrary
 * thresholds can binary-search the underlying value across repeated queries. A fixed
 * enumerated set removes that. This is the *only* form of threshold this system
 * supports — there is no "ask for any number" path anywhere in the API.
 *
 * The boundaries below are now chosen to reproduce the submitted deck's passport card
 * exactly: tenure >= 24 months, weeks paid >= 100, monthly income >= INR 18,000 are all
 * boundary values here, so the demo's issued passport reads identically to the card on
 * the slide. They are demo bands, not underwriting bands — if you later partner with an
 * actual lender, replace them with theirs.
 *
 * The circuit
 * (circuits/gigvault.circom) encodes these same boundaries as circuit constants — if
 * you change them here, you MUST also change them in the circuit and rerun
 * `npm run circuit:build`, or the commitment and the on-chain tier claim will diverge
 * silently (the exact "generated artifacts must match" failure your runbook warns
 * about).
 */

export const TENURE_TIERS_MONTHS = [0, 6, 12, 24, 36] as const;
export const WEEKS_TIERS = [0, 26, 52, 100, 150] as const;
export const INCOME_TIERS_INR = [0, 10000, 15000, 18000, 25000] as const;

export type TierIndex = number;

function tierIndexFor(value: number, boundaries: readonly number[]): TierIndex {
  let idx = 0;
  for (let i = 0; i < boundaries.length; i++) {
    if (value >= boundaries[i]) idx = i;
  }
  return idx;
}

export function tenureTierIndex(months: number): TierIndex {
  return tierIndexFor(months, TENURE_TIERS_MONTHS);
}

export function weeksTierIndex(weeks: number): TierIndex {
  return tierIndexFor(weeks, WEEKS_TIERS);
}

export function incomeTierIndex(monthlyIncomeInr: number): TierIndex {
  return tierIndexFor(monthlyIncomeInr, INCOME_TIERS_INR);
}

export function tierLabel(
  kind: 'tenure' | 'weeks' | 'income',
  idx: TierIndex,
): string {
  const table =
    kind === 'tenure'
      ? TENURE_TIERS_MONTHS
      : kind === 'weeks'
        ? WEEKS_TIERS
        : INCOME_TIERS_INR;
  const floor = table[idx];
  const unit = kind === 'income' ? '₹' : '';
  return `≥ ${unit}${floor}${kind === 'tenure' ? ' months' : ''}`;
}

export const TIER_COUNT = TENURE_TIERS_MONTHS.length; // 5; all three tables are same length

/**
 * Selective disclosure, downward-only.
 *
 * A rider may claim any tier at or below the highest one their real figures clear.
 * Claiming *above* is impossible by construction — the circuit enforces
 * `value >= boundary[claimedIdx]`, so an over-claim produces no witness at all. This
 * function exists so that failure surfaces as a clean 422 at the API boundary instead
 * of an opaque error from inside the snarkjs witness calculator (runbook: "get one
 * fact", don't make the caller read a stack trace to learn they asked for tier 4 on
 * tier-2 figures).
 *
 * Claiming downward is strictly privacy-improving and introduces no leak: the tier set
 * is fixed and enumerated, so there is no verifier-chosen threshold to binary-search
 * (zk-reference.md, "Choosing what is public"). A rider who presents "≥ 24 months" on
 * one day and "≥ 36 months" on another has disclosed "≥ 36 months" — which is exactly
 * what claiming maximally would have disclosed on day one. Nothing is learned that the
 * maximal claim would not already have given away.
 */
export function isClaimableTier(requested: number, actualMaxIdx: number): boolean {
  return (
    Number.isInteger(requested) &&
    requested >= 0 &&
    requested < TIER_COUNT &&
    requested <= actualMaxIdx
  );
}
