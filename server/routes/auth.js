/** Auth API: signup, login, logout, session/me. */
import { Router } from 'express';
import crypto from 'node:crypto';
import { all, get, insert, run } from '../db.js';
import {
  bcrypt, createSession, destroySession, isEmail, publicUser, requireAuth, str,
} from '../util.js';

const router = Router();

// ---------- SIGN UP ----------
router.post('/register', async (req, res, next) => {
  try {
    const name = str(req.body.name);
    const username = str(req.body.username).toLowerCase();
    const email = str(req.body.email).toLowerCase();
    const password = str(req.body.password);
    const confirm = str(req.body.confirm);
    const role = req.body.role === 'seller' ? 'seller' : 'buyer';

    const errors = [];
    if (!name || name.length < 2) errors.push('Full name is required (at least 2 characters).');
    if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
      errors.push('Username must be 3–20 characters (letters, numbers, underscores).');
    }
    if (!isEmail(email)) errors.push('Please enter a valid email address.');
    if (password.length < 8) errors.push('Password must be at least 8 characters.');
    if (password !== confirm) errors.push('Passwords do not match.');
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    if (await get('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (await get('SELECT id FROM users WHERE username = ?', [username])) {
      return res.status(409).json({ error: 'This username is already taken.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const id = await insert(
      `INSERT INTO users (name, username, email, password_hash, role, avatar, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [name, username, email, hash, role,
       `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
       new Date().toISOString(), new Date().toISOString()]
    );
    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    await insert('INSERT INTO carts (user_id, created_at, updated_at) VALUES (?,?,?)',
      [id, new Date().toISOString(), new Date().toISOString()]);
    await createSession(res, user, req.headers['user-agent']);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

// ---------- LOGIN ----------
router.post('/login', async (req, res, next) => {
  try {
    const identifier = str(req.body.identifier || req.body.email);
    const password = str(req.body.password);
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email/username and password.' });
    }
    const user = await get(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [identifier.toLowerCase(), identifier.toLowerCase()]
    );
    // Same message for unknown user and wrong password (no account enumeration)
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials. Please check your details and try again.' });
    }
    await createSession(res, user, req.headers['user-agent']);
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

// ---------- LOGOUT ----------
router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------- CURRENT USER ----------
router.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
});

// ---------- BECOME A SELLER ----------
router.post('/become-seller', requireAuth, async (req, res, next) => {
  try {
    await run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
      ['seller', new Date().toISOString(), req.user.id]);
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

export default router;
