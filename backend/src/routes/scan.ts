import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { AppError, Errors } from '../lib/errors.js';
import { qrPresentationPayload, parseQr, verifyHolderSignature, isEvmScheme } from '../lib/holderKey.js';
import { tierLabel } from '../lib/tiers.js';
import { verifyProofLocally } from '../zk/prove.js';
import { chainEnabled, onChainStatus } from '../chain/index.js';

const TTL = () => Number(process.env.PRESENTATION_TTL_SECONDS ?? 120);

/**
 * POST /present/ticket { sessionId }
 * Rider side. Returns a single-use ticket the rider signs into a QR. Nothing about
 * the passport is in the ticket; the QR only names the session and proves the holder
 * key signed it just now.
 */
export function registerScanRoutes(app: FastifyInstance) {
  app.post('/present/ticket', async (req, reply) => {
    const body = z.object({ sessionId: z.string().min(1) }).parse(req.body);
    const row = db.prepare('SELECT commitment, revoked FROM proofs WHERE session_id = ?').get(body.sessionId) as
      | { commitment: string; revoked: number } | undefined;
    if (!row) throw Errors.notIssued();
    if (row.revoked) throw new AppError(410, 'REVOKED', 'This passport has been revoked.');
    const ticketId = randomBytes(12).toString('base64url');
    const ttl = TTL();
    db.prepare(`INSERT INTO presentation_tickets (ticket_id, session_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
      .run(ticketId, body.sessionId, `+${ttl} seconds`);
    reply.code(201).send({
      ticketId, expiresInSeconds: ttl, commitment: row.commitment,
      payload: qrPresentationPayload({ sessionId: body.sessionId, ticketId, commitment: row.commitment }),
      qrFormat: 'GV1|<sessionId>|<ticketId>|<signature base64 (raw r||s, P-256/SHA-256)>',
    });
  });

  /**
   * POST /admit/scan { qr, verifierLabel? }
   * Verifier side — what the camera hands over. Step 07: true or false in two
   * seconds. Order: parse -> burn ticket (atomic, so two scanners cannot both win)
   * -> holder signature -> proof -> chain revocation + commitment. Any failure is a
   * named refusal; the card (four lines) is returned only on ADMITTED.
   */
  app.post('/admit/scan', async (req, reply) => {
    const body = z.object({ qr: z.string().min(1).max(2000), verifierLabel: z.string().max(120).optional() }).parse(req.body);
    const t0 = Date.now();
    const parsed = parseQr(body.qr);
    if (!parsed) throw new AppError(400, 'QR_UNRECOGNISED', 'Not a GigVault passport QR.');

    const ticket = db.prepare(
      `SELECT session_id, expires_at, consumed_at, (expires_at < datetime('now')) AS expired
       FROM presentation_tickets WHERE ticket_id = ?`).get(parsed.ticketId) as
      | { session_id: string; expires_at: string; consumed_at: string | null; expired: number } | undefined;
    if (!ticket || ticket.session_id !== parsed.sessionId) throw new AppError(404, 'TICKET_UNKNOWN', 'This QR was not issued by this operator for that passport.');
    if (ticket.consumed_at) throw new AppError(410, 'QR_ALREADY_USED', 'This QR has already been scanned. Ask the rider to show a fresh one.');
    if (ticket.expired) throw new AppError(410, 'QR_EXPIRED', 'This QR has expired. Ask the rider to show a fresh one.');
    const burn = db.prepare(
      `UPDATE presentation_tickets SET consumed_at = datetime('now'), consumed_by = ?
       WHERE ticket_id = ? AND consumed_at IS NULL`).run(body.verifierLabel ?? null, parsed.ticketId);
    if (burn.changes !== 1) throw new AppError(410, 'QR_ALREADY_USED', 'This QR was scanned by someone else a moment ago.');

    const proof = db.prepare(
      `SELECT commitment, proof_json, public_signals_json, tenure_tier_idx, weeks_tier_idx, income_tier_idx,
              holder_public_key, holder_key_scheme, revoked, token_id, issued_at, confirmed_payers_json FROM proofs WHERE session_id = ?`).get(parsed.sessionId) as any;
    if (!proof) throw Errors.notIssued();

    const sigOk = verifyHolderSignature({
      spkiBase64: proof.holder_public_key,
      payload: qrPresentationPayload({ sessionId: parsed.sessionId, ticketId: parsed.ticketId, commitment: proof.commitment }),
      signatureBase64: parsed.signature,
      scheme: proof.holder_key_scheme,
    });
    if (!sigOk) throw new AppError(403, 'HOLDER_SIGNATURE_INVALID', 'The QR was not signed by the key that holds this passport.');

    let admitted = false; let reason: string | null = null;
    if (proof.revoked) reason = 'REVOKED';
    else admitted = await verifyProofLocally(JSON.parse(proof.proof_json), JSON.parse(proof.public_signals_json));
    if (!admitted && !reason) reason = 'PROOF_INVALID';

    let chain: Awaited<ReturnType<typeof onChainStatus>> | null = null;
    if (admitted && chainEnabled() && proof.token_id) {
      chain = await onChainStatus(proof.token_id, proof.commitment);
      if (chain.revoked) { admitted = false; reason = 'REVOKED_ON_CHAIN'; }
      else if (!chain.commitmentMatches) { admitted = false; reason = 'COMMITMENT_MISMATCH'; }
      // zk-reference: soulbinding alone does not prove the presenter controls the
      // wallet — for that, the signing key must be ownerOf. With the EVM scheme it is
      // the same key, so check it; a custodial (P-256) passport cannot make this claim.
      else if (isEvmScheme(proof.holder_key_scheme) && chain.owner.toLowerCase() !== String(proof.holder_public_key).toLowerCase()) {
        admitted = false; reason = 'PRESENTER_NOT_OWNER';
      }
    }

    db.prepare('INSERT INTO admissions (session_id, verifier_label, result) VALUES (?, ?, ?)')
      .run(parsed.sessionId, body.verifierLabel ?? 'qr-scan', admitted ? 1 : 0);

    reply.send({
      admitted, reason, ms: Date.now() - t0,
      sessionId: parsed.sessionId, tokenId: proof.token_id, issuedAt: proof.issued_at, chain,
      holder: isEvmScheme(proof.holder_key_scheme) ? { address: proof.holder_public_key, ownsToken: chain ? chain.owner.toLowerCase() === String(proof.holder_public_key).toLowerCase() : null } : { custodial: true },
      disclosedPayers: admitted && proof.confirmed_payers_json ? JSON.parse(proof.confirmed_payers_json) : [],
      card: admitted ? {
        tenure: tierLabel('tenure', proof.tenure_tier_idx),
        weeksPaid: tierLabel('weeks', proof.weeks_tier_idx),
        monthlyIncome: tierLabel('income', proof.income_tier_idx),
      } : null,
    });
  });
}
