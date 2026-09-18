import nacl from 'tweetnacl';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AAProvider } from './accountAggregator.js';
import type {
  AAConsentArtefact,
  FiStatement,
  FiTransaction,
  SignedFiEnvelope,
} from './setuSchema.js';

/**
 * Signed mock FIP. Produces synthetic weekly-credit bank records on the real Setu FI
 * schema, signed with a local Ed25519 key so downstream code (name-match, tier
 * derivation, envelope publication) exercises the exact same path a real AA sandbox
 * handoff would. This is what H12's checkpoint note in the deck means by "we run a
 * signed mock FIP on the same schema, and say so on the slide" — this file is that
 * fallback, always on unless AA_PROVIDER=sandbox.
 *
 * This is NOT the gap flagged in the README. The mock itself is complete and honest
 * about being a mock (fipId is literally "MOCK-FIP-001"). The three real gaps are
 * listed in README.md and marked `// GAP:` in code.
 */

function loadOrCreateSigningKey(): nacl.SignKeyPair {
  const envKey = process.env.MOCK_FIP_SIGNING_KEY;
  if (envKey) {
    const secretKey = Buffer.from(envKey, 'base64');
    return nacl.sign.keyPair.fromSecretKey(secretKey);
  }

  const keyPath = path.resolve(process.cwd(), 'data', '.mock-fip-key');
  if (fs.existsSync(keyPath)) {
    const secretKey = Buffer.from(fs.readFileSync(keyPath, 'utf-8').trim(), 'base64');
    return nacl.sign.keyPair.fromSecretKey(secretKey);
  }

  const pair = nacl.sign.keyPair();
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, Buffer.from(pair.secretKey).toString('base64'));
  // eslint-disable-next-line no-console
  console.warn(
    `[mockFip] Generated a new dev signing key at ${keyPath}. Fine for the hackathon; do not reuse past it.`,
  );
  return pair;
}

const signingKeyPair = loadOrCreateSigningKey();

function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/**
 * Schema-accurate synthetic transactions from MULTIPLE counterparties — the exact
 * data shape the payer profiler (lib/payerProfiler.ts) needs to answer the Round 1
 * knockout question: "how do you decide which payment is salary vs family/friends?"
 *
 * Narration format matches real UPI:  UPI/<RRN>/<counterparty-name>/<VPA>/<bank>
 * NEFT format:                        NEFT/<UTR>/<counterparty-name>/<account-masked>/<bank>
 *
 * Counterparties are seeded by customerIdentifier so the same demo rider gets the
 * same numbers across a rehearsal. Includes adversarial rows:
 *   - A family member who pays weekly (looks like salary by cadence, but bidirectional)
 *   - A friend with ad-hoc both-ways transfers
 *   - Two real platforms with distinct patterns (Swiggy weekly, Zomato biweekly)
 */

interface CounterpartyConfig {
  name: string;
  vpa: string;
  bank: string;
  mode: 'UPI' | 'NEFT';
  credits: number;      // how many CREDIT txns to generate
  debits: number;       // how many DEBIT txns to generate (>0 → bidirectional)
  baseAmount: number;
  jitterRange: number;
  cadenceWeeks: number; // 1 = weekly, 2 = biweekly, etc.
  narrationPrefix?: string; // override for NEFT-style narrations
}

const COUNTERPARTIES: CounterpartyConfig[] = [
  // PRIMARY EMPLOYER — Swiggy: 130 weekly credits via UPI, machine-generated narration, pure inflow
  {
    name: 'SWIGGY PAYMENT', vpa: 'swiggy.payout@icici', bank: 'ICICI',
    mode: 'UPI', credits: 130, debits: 0, baseAmount: 5200, jitterRange: 400, cadenceWeeks: 1,
  },
  // SECONDARY EMPLOYER — Zomato: 26 biweekly credits via NEFT, pure inflow, different rail
  {
    name: 'ZOMATO HYPERPURE', vpa: 'zomato.salary@hdfc', bank: 'HDFC',
    mode: 'NEFT', credits: 26, debits: 0, baseAmount: 3800, jitterRange: 300, cadenceWeeks: 2,
  },
  // ADVERSARIAL: FAMILY — weekly credits (looks like salary by cadence!) BUT also has DEBIT rows.
  // Direction asymmetry is the signal that catches this: you never send money TO an employer.
  {
    name: 'MEENA KUMAR', vpa: 'meena.kumar@sbi', bank: 'SBI',
    mode: 'UPI', credits: 12, debits: 6, baseAmount: 2000, jitterRange: 500, cadenceWeeks: 4,
  },
  // ADVERSARIAL: FRIEND — ad-hoc, bidirectional, personal VPA, irregular
  {
    name: 'RAHUL S', vpa: 'rahul.sharma92@paytm', bank: 'PAYTM',
    mode: 'UPI', credits: 5, debits: 3, baseAmount: 800, jitterRange: 600, cadenceWeeks: 0, // irregular
  },
];

function generateRRN(seed: number, idx: number): string {
  return String(935314560000 + ((seed * 7 + idx * 13) >>> 0) % 999999).padStart(12, '0');
}

function synthesizeTransactions(customerIdentifier: string, _weeks: number): FiTransaction[] {
  let seed = 0;
  for (const ch of customerIdentifier) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;

  const txns: FiTransaction[] = [];
  const now = Date.now();
  const threeYearsMs = 156 * 7 * 24 * 3600 * 1000;

  for (const cp of COUNTERPARTIES) {
    // Generate CREDIT transactions
    for (let i = 0; i < cp.credits; i++) {
      const jitter = ((seed >> (i % 16)) % cp.jitterRange) - cp.jitterRange / 2;
      const amount = Math.max(500, cp.baseAmount + jitter);
      const weekOffset = cp.cadenceWeeks > 0
        ? (cp.credits - i) * cp.cadenceWeeks
        : Math.floor(Math.random() * 52) + 1; // irregular for cadenceWeeks=0
      const valueDate = new Date(now - weekOffset * 7 * 24 * 3600 * 1000);
      // Clamp to within 3 years
      if (now - valueDate.getTime() > threeYearsMs) continue;

      const rrn = generateRRN(seed, i);
      const narration = cp.mode === 'UPI'
        ? `UPI/${rrn}/${cp.name}/${cp.vpa}/${cp.bank}`
        : `NEFT/${rrn}/${cp.name}/XXXX${String(seed).slice(-4)}/${cp.bank}`;

      txns.push({
        txnId: randomUUID(),
        type: 'CREDIT',
        amount: amount.toFixed(2),
        narration,
        valueDate: valueDate.toISOString(),
        mode: cp.mode,
        reference: rrn,
        transactionTimestamp: valueDate.toISOString(),
      });
    }

    // Generate DEBIT transactions (only for adversarial counterparties)
    for (let i = 0; i < cp.debits; i++) {
      const jitter = ((seed >> ((i + 5) % 16)) % cp.jitterRange) - cp.jitterRange / 2;
      const amount = Math.max(200, cp.baseAmount * 0.6 + jitter);
      const weekOffset = Math.floor((cp.credits - i * 3) * (cp.cadenceWeeks || 4));
      const valueDate = new Date(now - weekOffset * 7 * 24 * 3600 * 1000);
      if (now - valueDate.getTime() > threeYearsMs) continue;

      const rrn = generateRRN(seed, i + 1000);
      txns.push({
        txnId: randomUUID(),
        type: 'DEBIT',
        amount: amount.toFixed(2),
        narration: `UPI/${rrn}/${cp.name}/${cp.vpa}/${cp.bank}`,
        valueDate: valueDate.toISOString(),
        mode: 'UPI',
        reference: rrn,
        transactionTimestamp: valueDate.toISOString(),
      });
    }
  }

  // Sort by date ascending (oldest first), matching real bank statement order
  txns.sort((a, b) => new Date(a.valueDate).getTime() - new Date(b.valueDate).getTime());
  return txns;
}

export class MockFIP implements AAProvider {
  private consents = new Map<string, AAConsentArtefact>();

  async requestConsent(input: {
    sessionId: string;
    customerIdentifier: string;
    purpose: string;
  }): Promise<AAConsentArtefact> {
    const now = new Date();
    const expiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 min, deliberately short for a demo
    const consent: AAConsentArtefact = {
      consentId: `mock-consent-${randomUUID()}`,
      sessionId: input.sessionId,
      customerIdentifier: input.customerIdentifier,
      purpose: input.purpose,
      fiTypes: ['DEPOSIT'],
      consentExpiry: expiry.toISOString(),
      dataRange: {
        from: new Date(now.getTime() - 156 * 7 * 24 * 3600 * 1000).toISOString(),
        to: now.toISOString(),
      },
      grantedAt: now.toISOString(),
    };
    this.consents.set(consent.consentId, consent);
    return consent;
  }

  async fetchStatement(consentId: string): Promise<SignedFiEnvelope> {
    const consent = this.consents.get(consentId);
    if (!consent) {
      throw new Error(`MockFIP: unknown consentId ${consentId}`);
    }
    if (new Date(consent.consentExpiry).getTime() < Date.now()) {
      throw new Error(`MockFIP: consent ${consentId} has expired`);
    }

    const statement: FiStatement = {
      linkRefNumber: `mock-link-${randomUUID()}`,
      maskedAccNumber: 'XXXXXXXX4821',
      fipId: 'MOCK-FIP-001',
      accountHolder: {
        // Demo default; overridable by caller in derive.ts via the rider-provided name
        // ONLY for wiring the demo — see README on why user-provided names are never
        // trusted for the actual off-circuit match.
        name: 'RAMESH KUMAR',
      },
      transactions: synthesizeTransactions(consent.customerIdentifier, 156),
      periodFrom: consent.dataRange.from,
      periodTo: consent.dataRange.to,
    };

    const payload = { statement, consent };
    const message = Buffer.from(canonicalize(payload));
    const signature = nacl.sign.detached(message, signingKeyPair.secretKey);

    const envelope: SignedFiEnvelope = {
      statement,
      consent,
      signature: Buffer.from(signature).toString('base64'),
      signerPublicKey: Buffer.from(signingKeyPair.publicKey).toString('base64'),
      signedAt: new Date().toISOString(),
    };
    return envelope;
  }

  async verifyEnvelope(envelope: SignedFiEnvelope): Promise<boolean> {
    const { statement, consent } = envelope;
    const message = Buffer.from(canonicalize({ statement, consent }));
    const signature = Buffer.from(envelope.signature, 'base64');
    const publicKey = Buffer.from(envelope.signerPublicKey, 'base64');
    return nacl.sign.detached.verify(message, signature, publicKey);
  }
}
