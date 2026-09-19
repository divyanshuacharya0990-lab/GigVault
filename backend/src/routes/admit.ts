import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { verifyProofLocally } from '../zk/prove.js';
import { chainEnabled, onChainStatus } from '../chain/index.js';
import { Errors } from '../lib/errors.js';

const AdmitRequestSchema = z.object({
  sessionId: z.string().min(1),
  verifierLabel: z.string().optional(),
});

/**
 * POST /admit
 * Entry 4, step 07: "true or false." This is the off-chain equivalent of the deck's
 * on-chain Admission contract check (contracts/GigVaultAdmission.sol) — useful for a
 * demo path that doesn't require a live chain connection. Verifies the stored proof
 * against the verification key and logs the check. Does NOT re-derive anything from
 * raw figures; it only checks the Groth16 proof against its public signals, exactly as
 * zk-reference.md describes: "the verifier learns nothing beyond the public signals."
 */
export function registerAdmitRoute(app: FastifyInstance) {
  app.post('/admit', async (req, reply) => {
    const body = AdmitRequestSchema.parse(req.body);

    const row = db
      .prepare('SELECT proof_json, public_signals_json, revoked, token_id, commitment, confirmed_payers_json FROM proofs WHERE session_id = ?')
      .get(body.sessionId) as
      | { proof_json: string; public_signals_json: string; revoked: number; token_id: string | null; commitment: string; confirmed_payers_json: string | null }
      | undefined;

    if (!row) {
      throw Errors.notIssued();
    }

    let result = false;
    if (!row.revoked) {
      result = await verifyProofLocally(JSON.parse(row.proof_json), JSON.parse(row.public_signals_json));
    }

    // Step 07 with the chain in the loop: the proof is only as good as the commitment
    // it was made over still being the one on the token, and the token not having been
    // revoked since. Neither needs the operator to be honest — a verifier can run the
    // same two reads against the public contract.
    let chain: Awaited<ReturnType<typeof onChainStatus>> | null = null;
    if (chainEnabled() && row.token_id) {
      chain = await onChainStatus(row.token_id, row.commitment);
      if (chain.revoked || !chain.commitmentMatches) result = false;
    }

    db.prepare(
      'INSERT INTO admissions (session_id, verifier_label, result) VALUES (?, ?, ?)',
    ).run(body.sessionId, body.verifierLabel ?? null, result ? 1 : 0);

    reply.send({ 
      sessionId: body.sessionId, 
      admitted: result, 
      chain,
      disclosedPayers: result && row.confirmed_payers_json ? JSON.parse(row.confirmed_payers_json) : [] 
    });
  });

  app.post('/admit/lookup', async (req, reply) => {
    const body = z.object({ tokenId: z.string().min(1), verifierLabel: z.string().optional() }).parse(req.body);

    const row = db
      .prepare('SELECT session_id, proof_json, public_signals_json, revoked, token_id, commitment, confirmed_payers_json, tenure_tier_idx, weeks_tier_idx, income_tier_idx, holder_public_key, holder_key_scheme, issued_at FROM proofs WHERE token_id = ? OR session_id = ?')
      .get(body.tokenId, body.tokenId) as any;

    if (!row) {
      reply.status(404).send({ error: 'NOT_FOUND', message: 'No passport found with that ID' });
      return;
    }

    let result = false;
    let reason = null;
    if (row.revoked) {
      reason = 'REVOKED';
    } else {
      result = await verifyProofLocally(JSON.parse(row.proof_json), JSON.parse(row.public_signals_json));
    }

    let chain: Awaited<ReturnType<typeof onChainStatus>> | null = null;
    if (chainEnabled() && row.token_id) {
      chain = await onChainStatus(row.token_id, row.commitment);
      if (chain.revoked) { result = false; reason = 'REVOKED_ON_CHAIN'; }
      else if (!chain.commitmentMatches) { result = false; reason = 'COMMITMENT_MISMATCH'; }
    }

    db.prepare(
      'INSERT INTO admissions (session_id, verifier_label, result) VALUES (?, ?, ?)',
    ).run(row.session_id, body.verifierLabel ?? 'id-lookup', result ? 1 : 0);

    const { tierLabel } = await import('../lib/tiers.js');
    const { isEvmScheme } = await import('../lib/holderKey.js');

    reply.send({ 
      sessionId: row.session_id, 
      admitted: result, 
      reason,
      tokenId: row.token_id,
      issuedAt: row.issued_at,
      chain,
      holder: isEvmScheme(row.holder_key_scheme) ? { address: row.holder_public_key, ownsToken: chain ? chain.owner.toLowerCase() === String(row.holder_public_key).toLowerCase() : null } : { custodial: true },
      disclosedPayers: result && row.confirmed_payers_json ? JSON.parse(row.confirmed_payers_json) : [],
      card: result ? {
        tenure: tierLabel('tenure', row.tenure_tier_idx),
        weeksPaid: tierLabel('weeks', row.weeks_tier_idx),
        monthlyIncome: tierLabel('income', row.income_tier_idx),
      } : null,
    });
  });
}
