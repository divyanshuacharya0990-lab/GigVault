import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { Errors } from '../lib/errors.js';
import type { SignedFiEnvelope } from '../adapters/setuSchema.js';

const DeriveRequestSchema = z.object({
  sessionId: z.string().min(1),
  confirmedPayers: z.array(z.string()).optional(),
});

/**
 * POST /derive
 * Deck step 03: "DERIVE — tenure, weeks, income," explicitly "on his phone" per the
 * slide art but corrected here to run on the operator per the Level-1 fix (see
 * README / src/zk/prove.ts doc comment) — this reads the AA envelope already stored
 * server-side and computes figures server-side. Nothing here touches the phone.
 *
 * Derivation logic is intentionally simple for the demo: count distinct weeks with a
 * CREDIT transaction, average the last 4 credited weeks for monthlyIncome, and treat
 * tenureMonths as weeks/4.33. This is a reasonable underwriting heuristic, not a
 * regulatory-grade one — swap for your real underwriting logic before this leaves the
 * hackathon.
 */
export function registerDeriveRoute(app: FastifyInstance) {
  app.post('/derive', async (req, reply) => {
    const body = DeriveRequestSchema.parse(req.body);

    const row = db
      .prepare('SELECT envelope_json FROM aa_envelopes WHERE session_id = ?')
      .get(body.sessionId) as { envelope_json: string } | undefined;

    if (!row) {
      throw Errors.fetchNotDone();
    }

    const envelope: SignedFiEnvelope = JSON.parse(row.envelope_json);
    let credits = envelope.statement.transactions.filter((t) => t.type === 'CREDIT');
    if (body.confirmedPayers && body.confirmedPayers.length > 0) {
      const allowedPayers = new Set(body.confirmedPayers);
      credits = credits.filter((t) => {
        if (!t.narration) return false;
        const parts = t.narration.split('/');
        if (parts.length >= 5 && (parts[0] === 'UPI' || parts[0] === 'NEFT' || parts[0] === 'IMPS')) {
          return allowedPayers.has(parts[2].trim());
        }
        return false;
      });
    }

    if (credits.length === 0) {
      reply.code(422).send({ error: 'NO_CREDITS', message: 'No credit transactions found in statement.' });
      return;
    }

    const weeksPaid = credits.length;
    const tenureMonths = Math.floor(weeksPaid / 4.33);

    // MONTHLY income, not weekly. Credits arrive weekly, so the monthly figure is the
    // weekly mean scaled by the average number of weeks in a month (52/12 = 4.333...),
    // NOT the weekly mean itself.
    //
    // This was a real bug: the previous version divided the last 4 credits by 4 and
    // stored the result as `monthlyIncome`, producing a ~5,000 weekly number where an
    // ~21,800 monthly number belonged. Downstream, incomeTierIndex(5043) returned tier
    // 0, so the issued passport claimed "≥ ₹0" while the deck's card claims
    // "≥ ₹18,000 ✓". Every tier boundary comparison and the on-stage card depend on
    // this one line having the right units.
    const WEEKS_PER_MONTH = 52 / 12;
    const recentCredits = credits.slice(-4);
    const weeklyMean =
      recentCredits.reduce((sum, t) => sum + parseFloat(t.amount), 0) / recentCredits.length;
    const monthlyIncome = Math.round(weeklyMean * WEEKS_PER_MONTH);

    // Run payer profiler
    const { profilePayers } = await import('../lib/payerProfiler.js');
    const payers = profilePayers(envelope.statement.transactions);

    // Run within a transaction using BEGIN/COMMIT
    try {
      db.exec('BEGIN');

      db.prepare(
        `INSERT INTO derived_figures (session_id, tenure_months, weeks_paid, monthly_income)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           tenure_months = excluded.tenure_months,
           weeks_paid = excluded.weeks_paid,
           monthly_income = excluded.monthly_income,
           derived_at = datetime('now')`,
      ).run(body.sessionId, tenureMonths, weeksPaid, monthlyIncome);

      // Create derived_payers table if not exists (defensive, though should be in schema.sql ideally)
      db.exec(`
        CREATE TABLE IF NOT EXISTS derived_payers (
          session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
          payer_profiles_json TEXT NOT NULL,
          derived_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.prepare(
        `INSERT INTO derived_payers (session_id, payer_profiles_json)
         VALUES (?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           payer_profiles_json = excluded.payer_profiles_json,
           derived_at = datetime('now')`,
      ).run(body.sessionId, JSON.stringify(payers));
      
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    reply.send({
      sessionId: body.sessionId,
      derived: { tenureMonths, weeksPaid, monthlyIncome },
      payers,
      note: 'Derived server-side from the AA-fetched envelope. Nothing was sent to or computed on a phone.',
    });
  });
}
