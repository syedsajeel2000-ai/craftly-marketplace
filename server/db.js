/**
 * Database access layer — the ONLY module that talks to Turso (libSQL).
 * Credentials are read from process.env and never reach the client.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./data/craftly.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

// Local file databases need their folder to exist (Turso remote needs nothing).
if (url.startsWith('file:')) {
  const filePath = url.slice('file:'.length);
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(abs), { recursive: true });
}

export const db = createClient({ url, authToken });

/** Run a statement, return rows. */
export async function all(sql, args = []) {
  const res = await db.execute({ sql, args });
  return res.rows;
}

/** Run a statement, return first row or undefined. */
export async function get(sql, args = []) {
  const res = await db.execute({ sql, args });
  return res.rows[0];
}

/** Run a write statement, return info. */
export async function run(sql, args = []) {
  return db.execute({ sql, args });
}

/** Insert and return the new rowid. */
export async function insert(sql, args = []) {
  const res = await db.execute({ sql, args });
  if (res.rowsAffected > 0) {
    const last = await db.execute('SELECT last_insert_rowid() AS id');
    return Number(last.rows[0].id);
  }
  return null;
}

/** Multi-statement atomic write (libsql batch runs in one transaction). */
export async function batch(statements) {
  return db.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    'write'
  );
}

export const NOW = () => new Date().toISOString();
