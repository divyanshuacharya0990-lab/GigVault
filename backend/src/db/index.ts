/**
 * Uses Node's built-in SQLite (node:sqlite) rather than better-sqlite3.
 *
 * WHY THIS CHANGED MID-HACKATHON: better-sqlite3 ships a prebuilt native binary per
 * platform/Node-version combination. On this machine the prebuild didn't match cleanly
 * and crashed on process teardown (a native assertion inside the compiled module, not
 * anything in this codebase), and there was no C++ compiler on PATH to rebuild it from
 * source. node:sqlite is compiled into the Node binary itself — nothing to prebuild,
 * nothing to compile, nothing that can mismatch. It ships experimental as of Node 22
 * (hence the warning on startup; harmless) and its statement API is close enough to
 * better-sqlite3's that no route code needed to change — prepare/run/get/all all work
 * the same way, positional `?` params included. The one difference used here:
 * DatabaseSync has no .pragma() helper, so PRAGMAs go through .exec() as plain SQL.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH ?? './data/gigvault.db';
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

const addColumnIfMissing = (table: string, column: string, definition: string) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

addColumnIfMissing('proofs', 'holder_public_key', 'TEXT');
addColumnIfMissing('proofs', 'holder_key_scheme', 'TEXT');
// On-chain record (Entry 3). NULL when CHAIN_MODE=off.
addColumnIfMissing('proofs', 'token_id', 'TEXT');
addColumnIfMissing('proofs', 'tx_hash', 'TEXT');
addColumnIfMissing('proofs', 'holder_address', 'TEXT');
addColumnIfMissing('proofs', 'custodial', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('proofs', 'confirmed_payers_json', 'TEXT');