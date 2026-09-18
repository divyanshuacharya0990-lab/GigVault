import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { aaProvider } from '../adapters/index.js';

const ConsentRequestSchema = z.object({
  customerIdentifier: z.string().min(1),
});

/**
 * POST /consent
 * Entry 1, step 01 in the deck: "he taps approve." Creates a session and requests an
 * AA consent artefact via whichever AAProvider is bound (mock by default).
 */
export function registerConsentRoute(app: FastifyInstance) {
  app.post('/consent', async (req, reply) => {
    const body = ConsentRequestSchema.parse(req.body);
    const sessionId = randomUUID();

    db.prepare(
      'INSERT INTO sessions (session_id, customer_identifier) VALUES (?, ?)',
    ).run(sessionId, body.customerIdentifier);

    const consent = await aaProvider.requestConsent({
      sessionId,
      customerIdentifier: body.customerIdentifier,
      purpose: 'GigVault work passport — bank credit history for tenure/income verification',
    });

    reply.code(201).send({ sessionId, consent });
  });
}
