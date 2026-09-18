import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { AppError, Errors } from '../lib/errors.js';
import { tierLabel } from '../lib/tiers.js';
import { presentationPayload, verifyHolderSignature } from '../lib/holderKey.js';

const PresentRequestSchema = z.object({
  sessionId: z.string().min(1),
  challengeId: z.string().min(1),
  signature: z.string().min(1), // base64, raw r||s over the presentation payload
});

interface ProofRow {
  commitment: string;
  proof_json: string;
  public_signals_json: string;
  tenure_tier_idx: number;
  weeks_tier_idx: number;
  income_tier_idx: number;
  token_id: string | null;
  revoked: number;
  issued_at: string;
  holder_public_key: string | null;
  holder_key_scheme: string | null;
}

/**
 * POST /present
 * Entry 4, step 06 — "one expiring QR," now actually expiring.
 *
 * What changed and why it mattered: this used to be GET /present/:sessionId, which
 * handed the stored proof to anyone who knew a session id, forever. Two of the three
 * limitations worth admitting to a judge lived in that one handler. zk-reference.md
 * names both: a Groth16 proof "says nothing about who is holding it," and soulbinding
 * "does not stop someone forwarding a copy of any data derived from the token;
 * freshness has to come from a challenge or an expiry."
 *
 * So a presentation now requires all four of these to hold at once:
 *   1. a challenge the verifier opened for this session,
 *   2. within its TTL,
 *   3. not already consumed,
 *   4. signed by the key registered at issue time.
 *
 * The challenge is burned before the proof is returned, not after — see the comment at
 * the consume step.
 */
export function registerPresentRoute(app: FastifyInstance) {
  app.post('/present', async (req, reply) => {
    const body = PresentRequestSchema.parse(req.body);

    const row = db
      .prepare(
        `SELECT commitment, proof_json, public_signals_json,
                tenure_tier_idx, weeks_tier_idx, income_tier_idx,
                token_id, revoked, issued_at, holder_public_key, holder_key_scheme
         FROM proofs WHERE session_id = ?`,
      )
      .get(body.sessionId) as ProofRow | undefined;

    if (!row) throw Errors.notIssued();

    if (!row.holder_public_key) {
      throw new AppError(
        409,
        'NO_HOLDER_KEY',
        'This passport was issued without a holder key, so no one can prove they hold ' +
          'it. Re-issue with holderPublicKey. (Passports issued before holder binding ' +
          'existed land here — this is deliberate: refusing is correct, and silently ' +
          'skipping the signature check would reintroduce the hole it closes.)',
      );
    }

    const challenge = db
      .prepare(
        `SELECT challenge_id, session_id, nonce, verifier_label, consumed_at,
                (expires_at <= datetime('now')) AS expired
         FROM presentation_challenges WHERE challenge_id = ?`,
      )
      .get(body.challengeId) as
      | {
          challenge_id: string;
          session_id: string;
          nonce: string;
          verifier_label: string | null;
          consumed_at: string | null;
          expired: number;
        }
      | undefined;

    if (!challenge || challenge.session_id !== body.sessionId) {
      // Same error either way: a challenge for another session is not a hint worth
      // giving out.
      throw new AppError(404, 'CHALLENGE_NOT_FOUND', 'No open challenge with that id for this session.');
    }
    if (challenge.consumed_at) {
      throw new AppError(
        410,
        'CHALLENGE_ALREADY_USED',
        'That challenge has already been presented against. Each one is good exactly ' +
          'once — ask the verifier to start a new check.',
      );
    }
    if (challenge.expired) {
      throw new AppError(
        410,
        'CHALLENGE_EXPIRED',
        'That challenge has expired. Ask the verifier to start a new check.',
      );
    }

    const payload = presentationPayload({
      sessionId: body.sessionId,
      challengeId: challenge.challenge_id,
      nonce: challenge.nonce,
      commitment: row.commitment,
    });

    const signatureOk = verifyHolderSignature({
      spkiBase64: row.holder_public_key,
      payload,
      signatureBase64: body.signature,
      scheme: row.holder_key_scheme,
    });

    if (!signatureOk) {
      throw new AppError(
        403,
        'HOLDER_SIGNATURE_INVALID',
        'The signature does not match the key this passport was issued to. Holding a ' +
          'copy of a passport is not the same as holding the passport.',
      );
    }

    // Consume BEFORE returning the proof. If this is left until after the response, a
    // client that fires the same request twice in parallel gets two valid
    // presentations from one challenge, and single-use quietly isn't. The UPDATE is
    // conditional on consumed_at still being null so the race is resolved by SQLite
    // rather than by hoping.
    const consumed = db
      .prepare(
        `UPDATE presentation_challenges SET consumed_at = datetime('now')
         WHERE challenge_id = ? AND consumed_at IS NULL`,
      )
      .run(challenge.challenge_id);

    if (consumed.changes !== 1) {
      throw new AppError(
        410,
        'CHALLENGE_ALREADY_USED',
        'That challenge was consumed by a concurrent request. Ask for a new check.',
      );
    }

    if (row.revoked) {
      db.prepare('INSERT INTO admissions (session_id, verifier_label, result) VALUES (?, ?, 0)').run(
        body.sessionId,
        challenge.verifier_label ?? null,
      );
      reply.send({ sessionId: body.sessionId, revoked: true, admitted: false });
      return;
    }

    reply.send({
      sessionId: body.sessionId,
      commitment: row.commitment,
      proof: JSON.parse(row.proof_json),
      publicSignals: JSON.parse(row.public_signals_json),
      tierClaims: {
        tenureTierIdx: row.tenure_tier_idx,
        weeksTierIdx: row.weeks_tier_idx,
        incomeTierIdx: row.income_tier_idx,
      },
      // Four lines, derived purely from the public tier indices. No rupee, month or
      // week figure appears anywhere in this response.
      card: {
        tenure: tierLabel('tenure', row.tenure_tier_idx),
        weeksPaid: tierLabel('weeks', row.weeks_tier_idx),
        monthlyIncome: tierLabel('income', row.income_tier_idx),
      },
      tokenId: row.token_id,
      revoked: false,
      issuedAt: row.issued_at,
      presentedFor: challenge.verifier_label ?? null,
      holderVerified: true,
    });
  });

  /**
   * The old route, kept only to fail loudly. Removing it outright would give a stale
   * client a connection error, which reads as "the server is down" and sends you
   * debugging the wrong layer — the runbook's single most expensive mistake. This says
   * exactly what happened and what to call instead.
   */
  app.get('/present/:sessionId', async () => {
    throw new AppError(
      410,
      'PRESENT_REQUIRES_CHALLENGE',
      'GET /present/:sessionId is gone. Presenting now requires proof that you hold the ' +
        'passport: POST /challenge to open a single-use challenge, sign its nonce with ' +
        'the holder key, then POST /present with { sessionId, challengeId, signature }.',
    );
  });
}
