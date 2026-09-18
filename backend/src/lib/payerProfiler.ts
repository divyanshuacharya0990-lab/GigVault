import type { FiTransaction } from '../adapters/setuSchema.js';
import { createHash } from 'node:crypto';

export interface SignalSet {
  directionAsymmetry: number;
  cadence: number;
  persistence: number;
  handleType: 'merchant' | 'personal' | 'unknown';
  railType: 'bulk' | 'adhoc' | 'unknown';
  narrationConsistency: number;
}

export interface PayerProfile {
  payerId: string;
  displayName: string;
  handle: string;
  txnCount: number;
  signals: SignalSet;
  confidenceTier: 'high' | 'medium' | 'low';
}

/**
 * Parses a narration string to extract the counterparty name and handle.
 * E.g., "UPI/12345/SWIGGY PAYMENT/swiggy.payout@icici/ICICI"
 * E.g., "NEFT/12345/ZOMATO HYPERPURE/XXXX1234/HDFC"
 */
function parseNarration(narration: string, mode: string): { name: string; handle: string } | null {
  const parts = narration.split('/');
  if (parts.length >= 4) {
    if (parts[0] === 'UPI') {
      return { name: parts[2], handle: parts[3] };
    }
    if (parts[0] === 'NEFT' || parts[0] === 'RTGS' || parts[0] === 'IMPS') {
      return { name: parts[2], handle: parts[3] };
    }
  }
  return null;
}

/**
 * Derives signals for a single counterparty.
 */
function computeSignals(txns: FiTransaction[]): SignalSet {
  let credits = 0;
  let debits = 0;
  let creditAmount = 0;
  let debitAmount = 0;
  const creditDates: Date[] = [];
  const handleTypes = new Set<'merchant' | 'personal' | 'unknown'>();
  const railTypes = new Set<'bulk' | 'adhoc' | 'unknown'>();
  const narrationFormats = new Set<string>();

  for (const t of txns) {
    const amt = parseFloat(t.amount);
    if (t.type === 'CREDIT') {
      credits++;
      creditAmount += amt;
      creditDates.push(new Date(t.transactionTimestamp || t.valueDate));
    } else if (t.type === 'DEBIT') {
      debits++;
      debitAmount += amt;
    }

    const mode = t.mode || 'UNKNOWN';
    if (mode === 'NEFT' || mode === 'RTGS') {
      railTypes.add('bulk');
    } else if (mode === 'UPI') {
      railTypes.add('adhoc');
    } else {
      railTypes.add('unknown');
    }

    const parsed = parseNarration(t.narration, mode);
    if (parsed) {
      const handle = parsed.handle.toLowerCase();
      if (handle.includes('payout') || handle.includes('salary') || handle.includes('biz') || handle.includes('merchant')) {
        handleTypes.add('merchant');
      } else if (handle.includes('@')) {
        // Simple heuristic for personal VPA: if no merchant keywords but has @
        handleTypes.add('personal');
      } else {
        handleTypes.add('unknown');
      }
      
      // Compute narration template (replace reference number with a generic token)
      const parts = t.narration.split('/');
      if (parts.length >= 4) {
        parts[1] = 'REF';
        narrationFormats.add(parts.join('/'));
      }
    }
  }

  // 1. directionAsymmetry
  // Pure inflow = 1.0, Bidirectional = close to 0.0
  let directionAsymmetry = 1.0;
  if (debits > 0) {
    directionAsymmetry = Math.max(0, 1.0 - (debits / (credits + debits)));
    // If there is significant money flowing OUT, penalize further
    if (debitAmount > creditAmount * 0.1) {
       directionAsymmetry *= 0.5;
    }
  }

  // 2. cadence (regularity of credits)
  let cadence = 0; // 1.0 is highly regular, 0.0 is highly irregular
  creditDates.sort((a, b) => a.getTime() - b.getTime());
  if (creditDates.length > 2) {
    const intervals: number[] = [];
    for (let i = 1; i < creditDates.length; i++) {
      intervals.push((creditDates[i].getTime() - creditDates[i - 1].getTime()) / (1000 * 3600 * 24));
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / (mean || 1);
    // Lower CV means more regular. If CV < 0.2 (very regular), cadence is near 1.0. If CV > 1.0, cadence is low.
    cadence = Math.max(0, 1.0 - Math.min(1.0, cv));
  }

  // 3. persistence (months with credits / total months spanning first to last credit)
  let persistence = 0;
  if (creditDates.length > 0) {
    const minDate = creditDates[0];
    const maxDate = creditDates[creditDates.length - 1];
    const totalMonths = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + maxDate.getMonth() - minDate.getMonth() + 1;
    const monthsWithCredit = new Set(creditDates.map(d => `${d.getFullYear()}-${d.getMonth()}`)).size;
    persistence = totalMonths > 0 ? monthsWithCredit / totalMonths : 1.0;
  }

  // 4. handleType
  let handleType: 'merchant' | 'personal' | 'unknown' = 'unknown';
  if (handleTypes.has('merchant')) handleType = 'merchant';
  else if (handleTypes.has('personal')) handleType = 'personal';

  // 5. railType
  let railType: 'bulk' | 'adhoc' | 'unknown' = 'unknown';
  if (railTypes.has('bulk')) railType = 'bulk';
  else if (railTypes.has('adhoc')) railType = 'adhoc';

  // 6. narrationConsistency (higher means fewer distinct templates)
  // If there are many transactions but only 1 format, consistency is 1.0
  const narrationConsistency = creditDates.length > 0 ? Math.max(0, 1.0 - ((narrationFormats.size - 1) / creditDates.length)) : 1.0;

  return {
    directionAsymmetry,
    cadence,
    persistence,
    handleType,
    railType,
    narrationConsistency,
  };
}

function determineTier(signals: SignalSet): 'high' | 'medium' | 'low' {
  // High confidence: mostly inflow, decent cadence, not a personal handle
  if (signals.directionAsymmetry > 0.9 && signals.cadence > 0.6 && signals.handleType !== 'personal') {
    return 'high';
  }
  // Low confidence: bidirectional flows or very ad-hoc personal transfers
  if (signals.directionAsymmetry < 0.6 || (signals.directionAsymmetry < 0.9 && signals.handleType === 'personal' && signals.railType === 'adhoc')) {
    return 'low';
  }
  return 'medium';
}

export function profilePayers(transactions: FiTransaction[]): PayerProfile[] {
  // 1. Group transactions by VPA/Handle
  const groups = new Map<string, FiTransaction[]>();
  const nameMap = new Map<string, string>();

  for (const t of transactions) {
    const parsed = parseNarration(t.narration, t.mode || 'UNKNOWN');
    if (parsed) {
      const handle = parsed.handle.toLowerCase();
      if (!groups.has(handle)) {
        groups.set(handle, []);
      }
      groups.get(handle)!.push(t);
      if (!nameMap.has(handle)) {
        nameMap.set(handle, parsed.name);
      }
    }
  }

  const profiles: PayerProfile[] = [];
  for (const [handle, txns] of groups.entries()) {
    const signals = computeSignals(txns);
    const confidenceTier = determineTier(signals);
    const displayName = nameMap.get(handle) || 'UNKNOWN PAYER';
    const payerId = createHash('sha256').update(handle).digest('hex').slice(0, 16);

    profiles.push({
      payerId,
      displayName,
      handle,
      txnCount: txns.length,
      signals,
      confidenceTier
    });
  }

  // Sort by confidence tier (high -> medium -> low), then by transaction count
  const tierWeight = { high: 3, medium: 2, low: 1 };
  profiles.sort((a, b) => {
    if (tierWeight[a.confidenceTier] !== tierWeight[b.confidenceTier]) {
      return tierWeight[b.confidenceTier] - tierWeight[a.confidenceTier];
    }
    return b.txnCount - a.txnCount;
  });

  return profiles;
}
