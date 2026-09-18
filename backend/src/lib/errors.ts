/**
 * Every route handler in this app is wrapped so a thrown error always produces an
 * HTTP error response instead of leaving the connection open. Per the runbook: "a
 * request handler that throws without writing a response" is the single most
 * expensive class of bug to chase in a 36-hour build, because it presents identically
 * to a dead server. See src/server.ts for the global handler that backstops this;
 * AppError lets route code throw with an intentional status code instead of relying
 * solely on that backstop.
 */
export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export const Errors = {
  consentMissing: () =>
    new AppError(400, 'CONSENT_MISSING', 'No valid AA consent artefact on file for this session.'),
  consentExpired: () =>
    new AppError(400, 'CONSENT_EXPIRED', 'AA consent artefact has expired; re-consent required.'),
  fetchNotDone: () =>
    new AppError(400, 'FETCH_NOT_DONE', 'Bank data has not been fetched for this session yet.'),
  nameMismatch: () =>
    new AppError(
      409,
      'NAME_MISMATCH',
      'Aadhaar QR name does not match the AA-fetched bank account holder name — refusing to issue.',
    ),
  nullifierReused: () =>
    new AppError(
      409,
      'NULLIFIER_REUSED',
      'This Aadhaar nullifier has already issued a passport. One human, one passport.',
    ),
  tierClaimTooHigh: (dimension: string, requested: number, maxAllowed: number) =>
    new AppError(
      422,
      'TIER_CLAIM_TOO_HIGH',
      `Requested ${dimension} tier ${requested} exceeds the highest tier these figures ` +
        `clear (${maxAllowed}). Tier claims are downward-only: a rider may disclose less ` +
        `than they have earned, never more. The circuit would refuse this claim anyway — ` +
        `this check exists so you get a named error instead of a witness-calculator failure.`,
    ),
  notIssued: () =>
    new AppError(404, 'NOT_ISSUED', 'No passport has been issued for this session yet.'),
  invalidUpload: () =>
    new AppError(
      403,
      'INVALID_SOURCE',
      'This endpoint accepts data only via the AA rail with valid consent. User-uploaded figures are rejected outright — see deck Exhibit A.',
    ),
};
