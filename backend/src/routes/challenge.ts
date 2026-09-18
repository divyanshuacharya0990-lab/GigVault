import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { Errors } from '../lib/errors.js';
import { randomNonce } from '../lib/holderKey.js';

const ChallengeRequestSchema = z.object({
  sessionId: z.string().min(1),
  verifierLabel: z.string().max(120).optional(),
});

/** Seconds a challenge stays open. Short by design: this is the window in which a
 *  rider taps to present, not a session length. */
export function presentationTtlSeconds(): number {
  const raw = Number(process.env.PRESENTATION_TTL_SECONDS ?? 120);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 120;
}

/**
 * POST /challenge
 *
 * The verifier's half of Entry 4. They ask to check a specific passport; they get back
 * a nonce that is good once, for two minutes. The rider signs it. Nothing about the
 * passport is returned here — an attacker who can open challenges all day learns only
 * whether a session id exists, which is why the 404 below is the same shape as any
 * other missing-session response.
 *
 * Why the verifier opens the challenge rather than the rider minting a token: freshness
 * has to be guaranteed to the party relying on it. A rider-minted token proves only
 * that the rider had a clock. The verifier generating the nonce is what makes a replay
 * of yesterday's presentation useless today — which is the whole point, since a proof
 * that travels alongside a token can otherwise be copied and forwarded indefinitely.
 */
export function registerChallengeRoute(app: FastifyInstance) {
  app.post('/challenge', async (req, reply) => {
    const body = ChallengeRequestSchema.parse(req.body);

    const exists = db
      .prepare('SELECT session_id FROM proofs WHERE session_id = ?')
      .get(body.sessionId) as { session_id: string } | undefined;
    if (!exists) {
      throw Errors.notIssued();
    }

    const challengeId = randomUUID();
    const nonce = randomNonce();
    const ttl = presentationTtlSeconds();

    db.prepare(
      `INSERT INTO presentation_challenges (challenge_id, session_id, nonce, verifier_label, expires_at)
       VALUES (?, ?, ?, ?, datetime('now', ?))`,
    ).run(challengeId, body.sessionId, nonce, body.verifierLabel ?? null, `+${ttl} seconds`);

    reply.code(201).send({
      challengeId,
      nonce,
      expiresInSeconds: ttl,
      scheme: 'ecdsa-p256-sha256',
      // Spelled out so a client author never has to guess the byte layout — a payload
      // mismatch between the two sides fails as a bare "invalid signature" with no
      // other diagnostic, and that is an expensive hour to spend.
      payloadTemplate:
        'GigVault presentation v1\\nsession={sessionId}\\nchallenge={challengeId}\\nnonce={nonce}\\ncommitment={commitment}',
    });
  });
}
