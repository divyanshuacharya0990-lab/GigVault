/**
 * Shape of a bank-statement Financial Information (FI) payload on the Setu / Account
 * Aggregator schema, trimmed to the fields this app actually reads. Whether this comes
 * from MockFIP (synthetic, locally signed) or a real AA sandbox, it arrives in this
 * shape — that's the entire point of the adapter interface in accountAggregator.ts.
 */

export interface FiTransaction {
  txnId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: string; // decimal string, paise-safe — never parse as JS Number for money math
  narration: string;
  valueDate: string; // ISO date
  /** Payment mode: how the money moved. Real AA deposit schema field. */
  mode?: 'UPI' | 'NEFT' | 'RTGS' | 'IMPS' | 'FT' | 'CASH' | 'OTHERS';
  /** Bank reference / UTR number. */
  reference?: string;
  /** ISO datetime of the transaction (more precise than valueDate). */
  transactionTimestamp?: string;
  /** Running balance after this transaction — not used for profiling, present for schema compliance. */
  currentBalance?: string;
}

export interface FiAccountHolder {
  name: string;
  // Deliberately no PAN/Aadhaar/mobile here — AA data-minimises to what's needed for
  // this use case, which is transaction history, not full KYC.
}

export interface FiStatement {
  linkRefNumber: string;
  maskedAccNumber: string;
  fipId: string; // "MOCK-FIP-001" for the mock, a real FIP id for sandbox
  accountHolder: FiAccountHolder;
  transactions: FiTransaction[];
  periodFrom: string;
  periodTo: string;
}

/** The consent artefact itself — what Entry 1 of the deck calls "he taps approve." */
export interface AAConsentArtefact {
  consentId: string;
  sessionId: string;
  customerIdentifier: string; // opaque handle, not the rider's real identity
  purpose: string;
  fiTypes: string[];
  consentExpiry: string; // ISO datetime
  dataRange: { from: string; to: string };
  grantedAt: string; // ISO datetime
}

/**
 * Signed envelope wrapping an FiStatement. This — the raw signature and the signer's
 * public key alongside it — is exactly the artefact Level 1 of the deck promises to
 * publish next to each commitment ("the pull is provable"). It is NOT proof that any
 * particular numeric threshold holds; it's proof the statement came from the named FIP
 * under the named consent, unmodified. The threshold claim is a separate, later step
 * (the Groth16 proof over the commitment).
 */
export interface SignedFiEnvelope {
  statement: FiStatement;
  consent: AAConsentArtefact;
  signature: string; // base64, Ed25519 over canonical JSON of {statement, consent}
  signerPublicKey: string; // base64
  signedAt: string; // ISO datetime
}
