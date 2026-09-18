-- GigVault SQLite schema.
-- SQLite chosen per Level-1 scope: one file, no server to stand up, trivial to reset
-- (`npm run db:reset`) mid-rehearsal per the runbook's "regenerate the whole set"
-- discipline extended to app state, not just circuit artifacts.

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  customer_identifier TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Entry 1: EVIDENCE. Consent + fetched, signed envelope. Published later alongside
-- the commitment so the pull is provable, per Level 1 of the trust ladder.
CREATE TABLE IF NOT EXISTS aa_envelopes (
  session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
  consent_id TEXT NOT NULL,
  envelope_json TEXT NOT NULL, -- full SignedFiEnvelope, serialized
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Entry 3/Level-1 note: raw figures live here ONLY transiently during /derive ->
-- /issue in the same request lifecycle in the reference implementation; this table
-- exists for demo inspectability (so a judge can see what was derived from what) but
-- is NOT what /present reads from — /present reads only the stored proof below. If you
-- want to harden this past the hackathon, stop persisting plaintext figures at all
-- once the proof is issued (DELETE the row in the same transaction as the INSERT into
-- proofs) rather than leaving them at rest.
CREATE TABLE IF NOT EXISTS derived_figures (
  session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
  tenure_months INTEGER NOT NULL,
  weeks_paid INTEGER NOT NULL,
  monthly_income INTEGER NOT NULL,
  derived_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Entry 2: IDENTITY. Anon Aadhaar nullifier binding + off-circuit name match result.
-- One row per nullifier, globally unique — "one human, one passport."
CREATE TABLE IF NOT EXISTS identity_bindings (
  session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
  nullifier TEXT NOT NULL UNIQUE,
  name_matched INTEGER NOT NULL, -- 0/1, result of off-circuit namesMatch()
  bound_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Entry 3: ISSUE. The Groth16 proof, generated exactly once server-side in /issue.
-- This is what /present reads from and what the rider's phone ultimately holds a copy
-- of — never the raw figures or salt (see src/zk/prove.ts).
CREATE TABLE IF NOT EXISTS proofs (
  session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
  commitment TEXT NOT NULL,
  proof_json TEXT NOT NULL,
  public_signals_json TEXT NOT NULL,
  tenure_tier_idx INTEGER NOT NULL,
  weeks_tier_idx INTEGER NOT NULL,
  income_tier_idx INTEGER NOT NULL,
  token_id TEXT, -- set once minted on-chain (Entry 3: "a hash on chain")
  revoked INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Entry 4: PRESENTATION / ADMIT. One row per verifier check, for the on-stage
-- "what is stored publicly" answer: a hash, an issuer, a date, a revocation flag —
-- this table is the operator-side audit log behind that answer, not itself public.
CREATE TABLE IF NOT EXISTS admissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  verifier_label TEXT,
  result INTEGER NOT NULL, -- 0/1
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Entry 4: PRESENTATION. Single-use, short-lived challenges.
--
-- zk-reference.md: soulbinding "does not stop someone forwarding a copy of any data
-- derived from the token; freshness has to come from a challenge or an expiry." This
-- table is that freshness. A verifier opens a challenge, the rider signs its nonce with
-- the key registered at issue time, and the challenge is burned on use. A captured
-- presentation is therefore worth nothing after its first use or its TTL, whichever
-- comes first.
CREATE TABLE IF NOT EXISTS presentation_challenges (
  challenge_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  nonce TEXT NOT NULL,
  verifier_label TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,             -- non-null once used; single-use is enforced on this
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_challenges_session ON presentation_challenges(session_id);

-- Entry 4 via QR. The rider's phone asks for a single-use ticket, signs
-- (session, ticket, commitment) with the key registered at issue, and shows
-- GV1|session|ticket|signature as a QR. Freshness here is expiry + single use
-- (server-issued), not a verifier-chosen nonce; /challenge + /present remains the
-- verifier-nonce path. Burned atomically on scan.
CREATE TABLE IF NOT EXISTS presentation_tickets (
  ticket_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_session ON presentation_tickets(session_id);
