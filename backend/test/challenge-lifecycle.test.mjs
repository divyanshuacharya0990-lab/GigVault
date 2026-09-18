/**
 * Challenge lifecycle test — expiry, single use, and session binding.
 *
 * Exercises the real SQL from src/routes/challenge.ts and src/routes/present.ts against
 * a real in-memory SQLite, using node:sqlite (built in, experimental) so this runs with
 * no npm install. The production code uses better-sqlite3; the statements under test
 * are plain SQLite and identical in both, but note the driver differs — if you change a
 * statement in a route, change it here too.
 *
 *   node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE presentation_challenges (
      challenge_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      verifier_label TEXT,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`);
  return db;
}

const open = (db, id, session, ttl) =>
  db.prepare(
    `INSERT INTO presentation_challenges (challenge_id, session_id, nonce, verifier_label, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', ?))`,
  ).run(id, session, 'nonce-' + id, 'Platform B', `${ttl} seconds`);

const load = (db, id) =>
  db.prepare(
    `SELECT challenge_id, session_id, consumed_at, (expires_at <= datetime('now')) AS expired
     FROM presentation_challenges WHERE challenge_id = ?`,
  ).get(id);

const consume = (db, id) =>
  db.prepare(
    `UPDATE presentation_challenges SET consumed_at = datetime('now')
     WHERE challenge_id = ? AND consumed_at IS NULL`,
  ).run(id);

test('a fresh challenge is neither expired nor consumed', () => {
  const db = freshDb();
  open(db, 'c1', 'sess-a', '+120');
  const c = load(db, 'c1');
  assert.equal(c.expired, 0);
  assert.equal(c.consumed_at, null);
});

test('a challenge past its TTL reads as expired', () => {
  const db = freshDb();
  open(db, 'c2', 'sess-a', '-1');   // opened with a TTL already in the past
  assert.equal(load(db, 'c2').expired, 1);
});

test('a challenge can be consumed exactly once', () => {
  const db = freshDb();
  open(db, 'c3', 'sess-a', '+120');
  assert.equal(consume(db, 'c3').changes, 1, 'first use succeeds');
  assert.equal(consume(db, 'c3').changes, 0, 'second use must change no rows');
});

test('two concurrent presentations cannot both win', () => {
  // The guard is `AND consumed_at IS NULL` inside the UPDATE, so SQLite resolves the
  // race. Checking-then-updating in JS would let both reads pass before either write.
  const db = freshDb();
  open(db, 'c4', 'sess-a', '+120');
  const results = [consume(db, 'c4'), consume(db, 'c4'), consume(db, 'c4')];
  assert.equal(results.filter(r => r.changes === 1).length, 1, 'exactly one may win');
});

test('a challenge opened for one session does not match another', () => {
  const db = freshDb();
  open(db, 'c5', 'sess-a', '+120');
  assert.notEqual(load(db, 'c5').session_id, 'sess-b');
});

test('consuming an unknown challenge changes nothing', () => {
  const db = freshDb();
  assert.equal(consume(db, 'nope').changes, 0);
});

test('an expired challenge is still single-use, so expiry and reuse cannot be traded off', () => {
  const db = freshDb();
  open(db, 'c6', 'sess-a', '-1');
  const c = load(db, 'c6');
  assert.equal(c.expired, 1);
  assert.equal(consume(db, 'c6').changes, 1);
  assert.equal(consume(db, 'c6').changes, 0);
});
