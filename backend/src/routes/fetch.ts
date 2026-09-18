import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { aaProvider } from '../adapters/index.js';
import { Errors } from '../lib/errors.js';

const FetchRequestSchema = z.object({
  sessionId: z.string().min(1),
  consentId: z.string().min(1),
});

/**
 * POST /fetch
 * Entry 1, step 02: "bank sends, encrypted." Pulls the signed FI envelope via the AA
 * rail (or MockFIP) and verifies its signature before persisting. This is the ONLY
 * route that writes to aa_envelopes — deck's "the pull is provable" claim rests on
 * this envelope being exactly what gets published later, unmodified.
 */
export function registerFetchRoute(app: FastifyInstance) {
  app.post('/fetch', async (req, reply) => {
    const body = FetchRequestSchema.parse(req.body);

    const envelope = await aaProvider.fetchStatement(body.consentId);

    const verified = await aaProvider.verifyEnvelope(envelope);
    if (!verified) {
      throw Errors.consentExpired();
    }

    db.prepare(
      `INSERT INTO aa_envelopes (session_id, consent_id, envelope_json)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         consent_id = excluded.consent_id,
         envelope_json = excluded.envelope_json,
         fetched_at = datetime('now')`,
    ).run(body.sessionId, body.consentId, JSON.stringify(envelope));

    reply.send({
      sessionId: body.sessionId,
      fipId: envelope.statement.fipId,
      accountHolderName: envelope.statement.accountHolder.name,
      transactionCount: envelope.statement.transactions.length,
      periodFrom: envelope.statement.periodFrom,
      periodTo: envelope.statement.periodTo,
    });
  });
}
