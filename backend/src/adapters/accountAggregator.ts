import type { AAConsentArtefact, SignedFiEnvelope } from './setuSchema.js';

/**
 * The interface any AA provider implements — mock or real sandbox. Route code
 * (src/routes/consent.ts, fetch.ts) talks only to this interface, never to MockFIP or
 * a sandbox client directly. Swapping AA_PROVIDER=sandbox in .env and implementing
 * this interface against real sandbox credentials is the entire integration surface;
 * no route code changes.
 */
export interface AAProvider {
  /** Rider taps approve; returns a consent artefact bound to a session. */
  requestConsent(input: {
    sessionId: string;
    customerIdentifier: string;
    purpose: string;
  }): Promise<AAConsentArtefact>;

  /** Given a live consent, fetch the signed FI statement — Entry 1 "bank sends the record." */
  fetchStatement(consentId: string): Promise<SignedFiEnvelope>;

  /** Verify an envelope's signature against the signer's known public key. */
  verifyEnvelope(envelope: SignedFiEnvelope): Promise<boolean>;
}
