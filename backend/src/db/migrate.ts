// Imported for its side effect: opening src/db/index.ts creates the SQLite file and
// applies schema.sql if not already present. Used by `npm run db:reset` after the
// file itself has been deleted.
import './index.js';

// eslint-disable-next-line no-console
console.log('gigvault.db created and schema applied.');
