/** Profile API — users may only read/edit their own profile. */
import { Router } from 'express';
import { get, run } from '../db.js';
import { bcrypt, isEmail, publicUser, requireAuth, str } from '../util.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
  try {
    const me = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!me) return res.status(404).json({ error: 'Account not found.' });

    const name = req.body.name !== undefined ? str(req.body.name) : me.name;
    const username = (req.body.username !== undefined ? str(req.body.username) : me.username).toLowerCase();
    const email = (req.body.email !== undefined ? str(req.body.email) : me.email).toLowerCase();
    const bio = req.body.bio !== undefined ? str(req.body.bio).slice(0, 500) : me.bio;
    const avatar = req.body.avatar !== undefined ? str(req.body.avatar) : me.avatar;

    const errors = [];
    if (name.length < 2) errors.push('Name must be at least 2 characters.');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) errors.push('Username must be 3–20 characters (letters, numbers, underscores).');
    if (!isEmail(email)) errors.push('Please enter a valid email address.');
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const dupeEmail = await get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (dupeEmail) return res.status(409).json({ error: 'That email is already in use.' });
    const dupeUser = await get('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id]);
    if (dupeUser) return res.status(409).json({ error: 'That username is already taken.' });

    await run(
      `UPDATE users SET name = ?, username = ?, email = ?, bio = ?, avatar = ?, updated_at = ? WHERE id = ?`,
      [name, username, email, bio || null, avatar || null, new Date().toISOString(), req.user.id]);

    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: publicUser(user), message: 'Profile updated' });
  } catch (err) { next(err); }
});

router.put('/password', async (req, res, next) => {
  try {
    const current = str(req.body.current_password);
    const next1 = str(req.body.new_password);
    const confirm = str(req.body.confirm_password);
    if (next1.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    if (next1 !== confirm) return res.status(400).json({ error: 'New passwords do not match.' });
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!(await bcrypt.compare(current, user.password_hash))) {
      return res.status(401).json({ error: 'Your current password is incorrect.' });
    }
    const hash = await bcrypt.hash(next1, 10);
    await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [hash, new Date().toISOString(), req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
});

export default router;
