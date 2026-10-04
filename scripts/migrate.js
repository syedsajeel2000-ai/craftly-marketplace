/**
 * Database migration runner.
 * Applies db/schema.sql (and future db/migrations/*.sql) to the Turso / libSQL
 * database, tracking applied files in the `_migrations` table so migrations
 * are only ever applied once.
 *
 * Usage: npm run db:migrate
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const url = process.env.TURSO_DATABASE_URL || 'file:./data/craftly.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export function makeClient() {
  // For local file databases, make sure the folder exists first.
  if (url.startsWith('file:')) {
    const filePath = url.slice('file:'.length);
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    mkdirSync(path.dirname(abs), { recursive: true });
  }
  return createClient({ url, authToken });
}

const files = [];
const schemaPath = path.join(root, 'db', 'schema.sql');
if (existsSync(schemaPath)) files.push({ name: 'schema.sql', path: schemaPath });
const extraDir = path.join(root, 'db', 'migrations');
if (existsSync(extraDir)) {
  for (const f of readdirSync(extraDir).sort()) {
    if (f.endsWith('.sql')) files.push({ name: f, path: path.join(extraDir, f) });
  }
}

/**
 * Splits a .sql file into individual statements.
 * Strips line comments first so a leading comment doesn't swallow its statement.
 */
export function splitSql(sql) {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const client = makeClient();
  try {
    await client.execute(
      `CREATE TABLE IF NOT EXISTS _migrations (
         name TEXT PRIMARY KEY,
         applied_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`
    );
    const applied = new Set(
      (await client.execute('SELECT name FROM _migrations')).rows.map((r) => String(r.name))
    );

    for (const file of files) {
      if (applied.has(file.name)) {
        console.log(`  = ${file.name} (already applied)`);
        continue;
      }
      const sql = readFileSync(file.path, 'utf8');
      const statements = splitSql(sql);
      await client.batch(
        statements.map((s) => ({ sql: s, args: [] })),
        'write'
      );
      await client.execute({
        sql: 'INSERT INTO _migrations (name) VALUES (?)',
        args: [file.name],
      });
      console.log(`  + ${file.name} applied`);
    }
    console.log('Database migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}
