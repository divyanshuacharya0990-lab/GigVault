import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { Errors } from '../lib/errors.js';
import { verifyAnonAadhaarProof, namesMatch } from '../adapters/anonAadhaar.js';
import { issueProof } from '../zk/prove.js';
import {
  tenureTierIndex,
  weeksTierIndex,
  incomeTierIndex,
  isClaimableTier,
  tierLabel,
} from '../lib/tiers.js';
import type { SignedFiEnvelope } from '../adapters/setuSchema.js';
import { assertValidHolderPublicKey, HOLDER_KEY_SCHEME, HOLDER_KEY_SCHEME_EVM, isEvmScheme } from '../lib/holderKey.js';
import { chainEnabled, issueOnChain } from '../chain/index.js';

const IssueRequestSchema = z.object({
  sessionId: z.string().min(1),
  // The rider's presentation key: base64 SPKI, P-256, generated non-extractable in the
  // browser so the private half never exists outside it. Required — without it nobody
  // can prove they hold this passport later, and /present would have to trust whoever
  // knows the session id. See lib/holderKey.ts.
  holderPublicKey: z.string().min(1),
  // 'ecdsa-p256-sha256' (browser WebCrypto key, default) or 'eip191-secp256k1' (the
  // rider's EVM wallet address — Privy embedded wallet or device-generated). With the
  // EVM scheme the passport is minted TO that address: ownerOf == presentation key.
  holderKeyScheme: z.enum([HOLDER_KEY_SCHEME, HOLDER_KEY_SCHEME_EVM]).optional(),
  // Optional EVM address (the rider's Privy wallet) to mint the soulbound token to when
  // CHAIN_MODE=on. Omitted => minted to the operator, flagged custodial. See chain/index.ts.
  holderAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  // From the rider's phone: the Anon Aadhaar nullifier proof, plus the name decoded
  // client-side from the Aadhaar Secure QR. The name arrives as plain data alongside
  // the proof, NOT as a circuit output — see adapters/anonAadhaar.ts doc comment.
  anonAadhaar: z.object({
    nullifier: z.string().min(1),
    proof: z.unknown(),
    publicSignals: z.unknown(),
    decodedName: z.string().min(1),
  }),
  // The list of payer names (e.g. Swiggy, Zomato) the rider confirms are their gig income
  confirmedPayers: z.array(z.string()).optional(),
  // Optional downward-only selective disclosure. Omit entirely and each figure claims
  // the highest tier it clears. Supply any subset to disclose less — e.g. a lender who
  // only underwrites on "at least 24 months" can be given exactly that and nothing
  // sharper. Validated against the derived figures below; never trusted as given.
  tierClaims: z
    .object({
      tenureTierIdx: z.number().int().min(0).optional(),
      weeksTierIdx: z.number().int().min(0).optional(),
      incomeTierIdx: z.number().int().min(0).optional(),
    })
    .optional(),
});

/**
 * POST /issue
 * Entry 2 (IDENTITY, off-circuit name match) + Entry 3 (ISSUE, Groth16 proof over the
 * commitment). This is the single call site for zk/prove.ts's issueProof() — see that
 * file's doc comment for why proving is server-side and exactly-once by design.
 *
 * Order of operations matters here: identity is bound and checked BEFORE the proof is
 * generated, so a name mismatch or nullifier reuse never gets as far as spending a
 * Groth16 proving run.
 */
export function registerIssueRoute(app: FastifyInstance) {
  app.post('/issue', async (req, reply) => {
    const body = IssueRequestSchema.parse(req.body);

    // Validate the holder key first: a malformed key should fail while the rider is
    // still in front of you, not later in front of a verifier.
    const scheme = body.holderKeyScheme ?? HOLDER_KEY_SCHEME;
    assertValidHolderPublicKey(body.holderPublicKey, scheme);
    // EVM scheme: the wallet address IS the holder address unless explicitly overridden.
    const holderAddress = body.holderAddress ?? (isEvmScheme(scheme) ? body.holderPublicKey : undefined);

    // 1. Anon Aadhaar nullifier verification (GAP: stub — see adapters/anonAadhaar.ts)
    const aadhaarResult = await verifyAnonAadhaarProof({
      nullifier: body.anonAadhaar.nullifier,
      proof: body.anonAadhaar.proof,
      publicSignals: body.anonAadhaar.publicSignals,
    });
    if (!aadhaarResult.valid) {
      reply.code(401).send({ error: 'AADHAAR_PROOF_INVALID' });
      return;
    }

    // 2. One human, one passport — nullifier must not already have issued.
    const existingByNullifier = db
      .prepare('SELECT session_id FROM identity_bindings WHERE nullifier = ?')
      .get(aadhaarResult.nullifier) as { session_id: string } | undefined;
    if (existingByNullifier && existingByNullifier.session_id !== body.sessionId) {
      throw Errors.nullifierReused();
    }

    // 3. Off-circuit name match against the AA-fetched bank record. This is the exact
    //    claim boundary flagged in README — say "off-circuit name match," not
    //    "in-circuit name matching," when presenting this.
    const envelopeRow = db
      .prepare('SELECT envelope_json FROM aa_envelopes WHERE session_id = ?')
      .get(body.sessionId) as { envelope_json: string } | undefined;
    if (!envelopeRow) {
      throw Errors.fetchNotDone();
    }
    const envelope: SignedFiEnvelope = JSON.parse(envelopeRow.envelope_json);
    const nameOk = namesMatch(body.anonAadhaar.decodedName, envelope.statement.accountHolder.name);

    db.prepare(
      `INSERT INTO identity_bindings (session_id, nullifier, name_matched)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         nullifier = excluded.nullifier,
         name_matched = excluded.name_matched,
         bound_at = datetime('now')`,
    ).run(body.sessionId, aadhaarResult.nullifier, nameOk ? 1 : 0);

    if (!nameOk) {
      throw Errors.nameMismatch();
    }

    // 4. Derived figures must exist (POST /derive must have run first).
    const figuresRow = db
      .prepare(
        'SELECT tenure_months, weeks_paid, monthly_income FROM derived_figures WHERE session_id = ?',
      )
      .get(body.sessionId) as
      | { tenure_months: number; weeks_paid: number; monthly_income: number }
      | undefined;
    if (!figuresRow) {
      reply.code(400).send({ error: 'NOT_DERIVED', message: 'Call /derive before /issue.' });
      return;
    }

    let tenureMonths = figuresRow.tenure_months;
    let weeksPaid = figuresRow.weeks_paid;
    let monthlyIncome = figuresRow.monthly_income;
    let confirmedPayers = body.confirmedPayers || [];

    // Re-aggregate based on confirmed payers if provided
    if (body.confirmedPayers && body.confirmedPayers.length > 0) {
      const allowedPayers = new Set(body.confirmedPayers);
      const credits = envelope.statement.transactions.filter(
        (t) => {
          if (t.type !== 'CREDIT' || !t.narration) return false;
          const parts = t.narration.split('/');
          if (parts.length >= 5 && (parts[0] === 'UPI' || parts[0] === 'NEFT' || parts[0] === 'IMPS')) {
            return allowedPayers.has(parts[2].trim());
          }
          return false;
        }
      );

      weeksPaid = credits.length;
      tenureMonths = Math.floor(weeksPaid / 4.33);

      const WEEKS_PER_MONTH = 52 / 12;
      const recentCredits = credits.slice(-4);
      const weeklyMean =
        recentCredits.length > 0
          ? recentCredits.reduce((sum, t) => sum + parseFloat(t.amount), 0) / recentCredits.length
          : 0;
      monthlyIncome = Math.round(weeklyMean * WEEKS_PER_MONTH);
    } else {
      // If no confirmedPayers, use all payers (or maybe derived_payers fallback).
      // For now we just use the raw figures which include everything.
      confirmedPayers = [];
    }

    const { computePayerNameHash } = await import('../zk/poseidon.js');
    const payerNameHash = computePayerNameHash(confirmedPayers);

    // 5. Resolve the tier claims. Downward-only: the rider may disclose less than
    //    their figures support, never more. The circuit enforces this regardless (an
    //    over-claim has no satisfying witness); this check exists so an over-claim
    //    returns a named 422 rather than a snarkjs witness-calculator failure.
    const maxTiers = {
      tenureTierIdx: tenureTierIndex(tenureMonths),
      weeksTierIdx: weeksTierIndex(weeksPaid),
      incomeTierIdx: incomeTierIndex(monthlyIncome),
    };

    const requested = body.tierClaims;
    if (requested) {
      const dims = [
        ['tenure', requested.tenureTierIdx, maxTiers.tenureTierIdx],
        ['weeks', requested.weeksTierIdx, maxTiers.weeksTierIdx],
        ['income', requested.incomeTierIdx, maxTiers.incomeTierIdx],
      ] as const;
      for (const [name, req, max] of dims) {
        if (req !== undefined && !isClaimableTier(req, max)) {
          throw Errors.tierClaimTooHigh(name, req, max);
        }
      }
    }

    // 6. Generate the Groth16 proof — server-side, once. Raw figures and salt never
    //    leave this function; see zk/prove.ts doc comment for why.
    const issued = await issueProof(
      {
        tenureMonths,
        weeksPaid,
        monthlyIncome,
        payerNameHash,
      },
      requested,
    );

    db.prepare(
      `INSERT INTO proofs
         (session_id, commitment, proof_json, public_signals_json,
          tenure_tier_idx, weeks_tier_idx, income_tier_idx,
          holder_public_key, holder_key_scheme, confirmed_payers_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         commitment = excluded.commitment,
         proof_json = excluded.proof_json,
         public_signals_json = excluded.public_signals_json,
         tenure_tier_idx = excluded.tenure_tier_idx,
         weeks_tier_idx = excluded.weeks_tier_idx,
         income_tier_idx = excluded.income_tier_idx,
         holder_public_key = excluded.holder_public_key,
         holder_key_scheme = excluded.holder_key_scheme,
         confirmed_payers_json = excluded.confirmed_payers_json,
         issued_at = datetime('now')`,
    ).run(
      body.sessionId,
      issued.commitment,
      JSON.stringify(issued.proof),
      JSON.stringify(issued.publicSignals),
      issued.tierClaims.tenureTierIdx,
      issued.tierClaims.weeksTierIdx,
      issued.tierClaims.incomeTierIdx,
      body.holderPublicKey,
      scheme,
      JSON.stringify(confirmedPayers),
    );

    // 7. Entry 3 — commitment on chain. Admission.issue() re-verifies the proof on
    //    chain and mints the ERC-5192 token; a second passport for the same nullifier
    //    reverts there too. Off unless CHAIN_MODE=on.
    let chain: Awaited<ReturnType<typeof issueOnChain>> | null = null;
    if (chainEnabled()) {
      chain = await issueOnChain({
        holderAddress,
        nullifier: aadhaarResult.nullifier,
        proof: issued.proof,
        publicSignals: issued.publicSignals,
      });
      db.prepare(
        'UPDATE proofs SET token_id = ?, tx_hash = ?, holder_address = ?, custodial = ? WHERE session_id = ?',
      ).run(chain.tokenId, chain.txHash, chain.holder, chain.custodial ? 1 : 0, body.sessionId);
    }

    reply.code(201).send({
      sessionId: body.sessionId,
      commitment: issued.commitment,
      tierClaims: issued.tierClaims,
      chain,
      // The four lines the rider's card shows. Derived from the tier indices only —
      // no raw figure is ever formatted into this response.
      card: {
        tenure: tierLabel('tenure', issued.tierClaims.tenureTierIdx),
        weeksPaid: tierLabel('weeks', issued.tierClaims.weeksTierIdx),
        monthlyIncome: tierLabel('income', issued.tierClaims.incomeTierIdx),
      },
      disclosure: requested ? 'selective' : 'maximal',
      note: 'Proof generated server-side and stored. Raw figures and salt are not included in this response and are not retrievable via any route.',
    });
  });
}
