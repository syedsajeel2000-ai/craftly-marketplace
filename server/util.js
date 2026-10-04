/**
 * Shared helpers: cookies, session management, auth middleware,
 * response utilities and input validation.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { all, get, insert, run } from './db.js';

const SESSION_DAYS = 30;

// ---------------- cookies ----------------
export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

export function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  parts.push(`HttpOnly`);
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expires) parts.push(`Expires=${new Date(opts.expires).toUTCString()}`);
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const cookie = parts.join('; ');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

// ---------------- sessions ----------------
export async function createSession(res, user, userAgent) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await insert(
    `INSERT INTO user_sessions (user_id, token, user_agent, expires_at, created_at)
     VALUES (?,?,?,?,?)`,
    [user.id, token, (userAgent || '').slice(0, 200), expires.toISOString(), new Date().toISOString()]
  );
  setCookie(res, 'craftly_session', token, { maxAge: SESSION_DAYS * 86400 });
  return token;
}

export async function destroySession(req, res) {
  const token = parseCookies(req).craftly_session;
  if (token) {
    await run('DELETE FROM user_sessions WHERE token = ?', [token]);
  }
  clearCookie(res, 'craftly_session');
}

/** Resolves req.user from the session cookie (if valid & unexpired). */
export async function loadUser(req, res, next) {
  try {
    const token = parseCookies(req).craftly_session;
    req.user = null;
    if (token) {
      const row = await get(
        `SELECT u.id, u.name, u.username, u.email, u.role, u.avatar, u.bio, u.created_at,
                s.expires_at
           FROM user_sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token = ?`,
        [token]
      );
      if (row && new Date(row.expires_at).getTime() > Date.now()) {
        req.user = { id: Number(row.id), name: row.name, username: row.username, email: row.email, role: row.role, avatar: row.avatar, bio: row.bio, created_at: row.created_at };
      } else if (token) {
        await run('DELETE FROM user_sessions WHERE token = ?', [token]);
        clearCookie(res, 'craftly_session');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

export function requireSeller(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.user.role !== 'seller' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'A seller account is required for this action.' });
  }
  next();
}

// ---------------- validation ----------------
export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, username: u.username, email: u.email,
    role: u.role, avatar: u.avatar, bio: u.bio, created_at: u.created_at,
  };
}

export async function safeCall(fn, fallbackMessage = 'Something went wrong. Please try again.') {
  try {
    return await fn();
  } catch (err) {
    console.error('[api]', err.message);
    const e = new Error(fallbackMessage);
    e.status = 500;
    throw e;
  }
}

export { bcrypt };
