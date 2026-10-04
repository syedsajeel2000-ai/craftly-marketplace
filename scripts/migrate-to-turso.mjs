/**
 * Copy the local catalogue into the hosted (Turso) database.
 *
 * The demo database lives in a local SQLite file, which a serverless platform
 * cannot use — its filesystem is read-only and resets on every cold start. This
 * copies the existing rows into the remote database so the deployed site shows
 * exactly the catalogue that is on disk here, rather than an empty marketplace.
 *
 * Order matters: children before parents, because of the foreign keys.
 * Rows are inserted with explicit ids so sequences stay in step afterwards.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… node scripts/migrate-to-turso.mjs
 *   DRY=1 …            preview row counts without writing anything
 */
import { createClient } from '@libsql/client';

const LOCAL_URL = process.env.LOCAL_DATABASE_URL || 'file:./data/craftly.db';
const REMOTE_URL = process.env.TURSO_DATABASE_URL;
const REMOTE_TOKEN = process.env.TURSO_AUTH_TOKEN;
const DRY = process.env.DRY === '1';
const CHUNK = 200;

// Parents first, then children.
const TABLES = [
  'users',
  'categories',
  'products',
  'product_reviews',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'wishlist',
  'inventory_logs',
  'user_sessions',
  'daily_batches',
  'seed_batches',
];

async function main() {
  if (!REMOTE_URL) {
    console.error('TURSO_DATABASE_URL is not set — create the database at turso.tech first.');
    process.exit(1);
  }
  if (!/^(libsql:\/\/|file:)/.test(REMOTE_URL)) {
    console.error(`TURSO_DATABASE_URL must be a libsql:// URL (got ${REMOTE_URL.slice(0, 20)}…).`);
    process.exit(1);
  }
  if (!/^libsql:\/\//.test(REMOTE_URL)) {
    console.log('  NOTE: target is a local file, not Turso — fine for testing, not for production.\n');
  }

  const local = createClient({ url: LOCAL_URL });
  const remote = createClient({ url: REMOTE_URL, authToken: REMOTE_TOKEN });

  console.log(`  from: ${LOCAL_URL}`);
  console.log(`  to:   ${REMOTE_URL.replace(/\/\/[^@]*@/, '//***@')}`);
  if (DRY) console.log('  (DRY run — nothing will be written)\n');

  const remoteTables = new Set(
    (await remote.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`)).rows.map((r) => r.name)
  );

  let copied = 0;
  for (const table of TABLES) {
    if (!remoteTables.has(table)) {
      console.log(`  - ${table.padEnd(16)} skipped (not in the remote schema)`);
      continue;
    }

    const rows = (await local.execute(`SELECT * FROM ${table}`)).rows;
    if (!rows.length) {
      console.log(`  - ${table.padEnd(16)} 0 rows`);
      continue;
    }

    if (DRY) {
      console.log(`  - ${table.padEnd(16)} would copy ${rows.length}`);
      copied += rows.length;
      continue;
    }

    const cols = Object.keys(rows[0]);
    const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    const statements = rows.map((row) => ({ sql, args: cols.map((c) => normalise(row[c])) }));

    // Auto-increment counters must not lag behind the explicit ids we insert.
    if (cols.includes('id')) {
      const maxId = Math.max(...rows.map((r) => Number(r.id) || 0));
      await remote.execute(
        `INSERT INTO sqlite_sequence(name, seq) SELECT '${table}', ${maxId}
          WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = '${table}')
           OR (SELECT seq FROM sqlite_sequence WHERE name = '${table}') < ${maxId}`
      ).catch(() => {});
    }

    for (let i = 0; i < statements.length; i += CHUNK) {
      await remote.batch(statements.slice(i, i + CHUNK), 'write');
    }
    const got = await remote.execute(`SELECT COUNT(*) AS c FROM ${table}`);
    console.log(`  + ${table.padEnd(16)} ${rows.length} → ${Number(got.rows[0].c)}`);
    copied += rows.length;
  }

  console.log(`\n  ${DRY ? 'would copy' : 'copied'} ${copied} rows`);
  if (!DRY) {
    const check = await remote.execute(
      `SELECT (SELECT COUNT(*) FROM products) AS products,
              (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
              (SELECT COUNT(*) FROM product_reviews) AS reviews`
    );
    const r = check.rows[0];
    console.log(`  remote now: ${r.products} listings · ${r.sellers} sellers · ${r.reviews} reviews`);
  }
}

/** libSQL rejects undefined; normalise to null so optional columns round-trip. */
const normalise = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
