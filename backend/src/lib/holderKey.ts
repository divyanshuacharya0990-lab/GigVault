import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { AppError } from './errors.js';

/**
 * Holder binding.
 *
 * zk-reference.md is blunt about the gap this closes: "a proof says nothing about who
 * is holding it. Groth16 gives soundness and zero-knowledge, not authentication.
 * Binding a proof to a person is a separate problem, solved outside the circuit (a
 * signature, a session, a challenge)." Before this file existed, /present handed the
 * stored proof to anyone who knew a session id — so a forwarded reference was as good
 * as the passport itself, and soulbinding the token bought nothing, because nobody was
 * ever asked to prove they controlled the key.
 *
 * Scheme: ECDSA over P-256, SHA-256, raw r||s signatures. Chosen for one reason that
 * matters more than elegance here — it needs no dependency on either side. The browser
 * has it in WebCrypto (universally, unlike Ed25519, whose WebCrypto support is still
 * patchy) and Node verifies it from the standard library. A hackathon demo that dies
 * because a polyfill didn't install is a worse outcome than a curve nobody will
 * compliment you on.
 *
 * The rider's private key is generated non-extractable in the browser and never leaves
 * it. The operator stores only the public key. Note what this does and does not give
 * you: it proves the presenter controls the key that was registered at issue time. It
 * does not prove that key belongs to the human whose Aadhaar was scanned — that link
 * is the nullifier's job, and it is only as good as Anon Aadhaar verification being in
 * real mode.
 *
 * If you move the rider client to an EVM wallet (Privy, per the deck), swap this for
 * secp256k1 ecrecover against the token's ownerOf — same call sites, same payload
 * discipline. Keep the payload construction below identical if you do; it is the part
 * that must not drift.
 */

export const HOLDER_KEY_SCHEME = 'ecdsa-p256-sha256';
/**
 * Second scheme: the rider's EVM wallet (Privy embedded wallet, or the device-generated
 * one in public/index.html). holderPublicKey is then the 0x address, the signature is
 * EIP-191 personal_sign over the same payload strings, and the address is what the
 * passport is minted to — so ownerOf(tokenId) and the presentation key are one key.
 */
export const HOLDER_KEY_SCHEME_EVM = 'eip191-secp256k1';
export type HolderKeyScheme = typeof HOLDER_KEY_SCHEME | typeof HOLDER_KEY_SCHEME_EVM;
export function isEvmScheme(s: string | null | undefined): boolean { return s === HOLDER_KEY_SCHEME_EVM; }

/**
 * The exact bytes the holder signs. Everything that must not be swapped between a
 * signature and the thing it authorises goes in here: the session, the single-use
 * challenge, the nonce, and the commitment being presented.
 *
 * Signing a bare nonce would be a mistake — a signature over a nonce alone could be
 * replayed against a different session's presentation if an operator ever issued one
 * challenge across two sessions. Binding the commitment means a captured signature
 * cannot be reused to present a *different* passport even in that case.
 *
 * This string is a wire format. Change it and every previously issued key still works
 * but every in-flight challenge breaks; change it on only one side and signatures fail
 * with no diagnostic beyond "invalid", which is the most expensive possible way to
 * spend a demo slot. Client counterpart: `presentationPayload()` in public/index.html.
 */
export function presentationPayload(args: {
  sessionId: string;
  challengeId: string;
  nonce: string;
  commitment: string;
}): string {
  return [
    'GigVault presentation v1',
    `session=${args.sessionId}`,
    `challenge=${args.challengeId}`,
    `nonce=${args.nonce}`,
    `commitment=${args.commitment}`,
  ].join('\n');
}

/** Rejects anything that isn't a usable SPKI P-256 key, at issue time rather than at
 *  presentation time — so a malformed key fails while the rider is still standing
 *  there, not in front of a verifier. */
export function assertValidHolderPublicKey(spkiBase64: string, scheme: string = HOLDER_KEY_SCHEME): void {
  if (scheme === HOLDER_KEY_SCHEME_EVM) {
    if (!ethers.isAddress(spkiBase64)) {
      throw new AppError(400, 'HOLDER_KEY_INVALID', `For scheme ${HOLDER_KEY_SCHEME_EVM}, holderPublicKey must be the rider's 0x wallet address.`);
    }
    return;
  }
  if (scheme !== HOLDER_KEY_SCHEME) {
    throw new AppError(400, 'HOLDER_KEY_INVALID', `Unknown holderKeyScheme ${scheme}; use ${HOLDER_KEY_SCHEME} or ${HOLDER_KEY_SCHEME_EVM}.`);
  }
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(spkiBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const details = key.asymmetricKeyDetails;
    if (key.asymmetricKeyType !== 'ec' || details?.namedCurve !== 'prime256v1') {
      throw new Error('not P-256');
    }
  } catch {
    throw new AppError(
      400,
      'HOLDER_KEY_INVALID',
      'holderPublicKey must be a base64-encoded SPKI public key on P-256 (prime256v1). ' +
        'Produce it in the browser with crypto.subtle.generateKey({name:"ECDSA",' +
        'namedCurve:"P-256"}, false, ["sign"]) then exportKey("spki") on the public half.',
    );
  }
}

/**
 * Verifies a raw r||s signature. Returns a boolean rather than throwing, because the
 * caller distinguishes "wrong signature" (403, the rider is not the holder) from
 * "malformed request" (400) and those deserve different words in front of a judge.
 */
export function verifyHolderSignature(args: {
  spkiBase64: string;
  payload: string;
  signatureBase64: string;
  scheme?: string | null;
}): boolean {
  if (isEvmScheme(args.scheme)) {
    // EIP-191: recover the signer of personal_sign(payload) and compare to the address.
    try {
      return ethers.verifyMessage(args.payload, args.signatureBase64).toLowerCase() === args.spkiBase64.toLowerCase();
    } catch { return false; }
  }
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(args.spkiBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      'sha256',
      Buffer.from(args.payload, 'utf-8'),
      // WebCrypto emits raw r||s (64 bytes for P-256); Node defaults to DER. Without
      // this line every signature fails verification while looking perfectly valid on
      // the client — the exact "two observations contradict each other" trap the
      // runbook warns about.
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(args.signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}

export function randomNonce(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Payload the rider signs to put his passport in a QR. Wire format shared with
 * public/index.html (qrPayload()); change both or every scan fails as "invalid".
 * The QR string itself is:  GV1|<sessionId>|<ticketId>|<signature base64>
 */
export const QR_PREFIX = 'GV1';
export function qrPresentationPayload(args: { sessionId: string; ticketId: string; commitment: string }): string {
  return ['GigVault qr v1', `session=${args.sessionId}`, `ticket=${args.ticketId}`, `commitment=${args.commitment}`].join('\n');
}
export function parseQr(qr: string): { sessionId: string; ticketId: string; signature: string } | null {
  const parts = qr.trim().split('|');
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return null;
  const [, sessionId, ticketId, signature] = parts;
  if (!sessionId || !ticketId || !signature) return null;
  return { sessionId, ticketId, signature };
}
