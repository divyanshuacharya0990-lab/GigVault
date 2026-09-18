import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { Errors } from '../lib/errors.js';
import { chainEnabled, revokeOnChain } from '../chain/index.js';

const RevokeRequestSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().max(200).optional(),
});

/**
 * POST /revoke — operator-side. Consent withdrawn, record superseded, fraud found.
 * Flips the SQLite flag and, with CHAIN_MODE=on, the on-chain flag via
 * GigVaultAdmission.revoke() (owner-only there, so only the operator key can).
 *
 * Honest limitation, same as the contract comment: the operator can revoke
 * unilaterally. That is Level 1. Do not call it trustless on stage.
 */
export function registerRevokeRoute(app: FastifyInstance) {
  app.post('/revoke', async (req, reply) => {
    const body = RevokeRequestSchema.parse(req.body);
    const row = db.prepare('SELECT token_id, revoked FROM proofs WHERE session_id = ?').get(body.sessionId) as
      | { token_id: string | null; revoked: number } | undefined;
    if (!row) throw Errors.notIssued();
    if (row.revoked) { reply.send({ sessionId: body.sessionId, revoked: true, alreadyRevoked: true }); return; }

    let chain: { txHash: string } | null = null;
    if (chainEnabled() && row.token_id) chain = await revokeOnChain(row.token_id);

    db.prepare('UPDATE proofs SET revoked = 1 WHERE session_id = ?').run(body.sessionId);
    reply.send({ sessionId: body.sessionId, revoked: true, reason: body.reason ?? null, chain });
  });
}
