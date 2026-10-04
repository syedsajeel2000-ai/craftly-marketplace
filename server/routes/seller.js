/**
 * Seller API — stats, product CRUD, inventory management.
 * Every query is scoped to the authenticated seller (ownership checks).
 */
import { Router } from 'express';
import { all, get, insert, run } from '../db.js';
import { requireAuth, requireSeller, str, isEmail } from '../util.js';
import { shapeProduct } from './products.js';

const router = Router();
router.use(requireAuth, requireSeller);

const VALID_TYPES = ['handmade', 'vintage', 'digital'];

// ---------------- OVERVIEW STATS ----------------
router.get('/stats', async (req, res, next) => {
  try {
    const s = req.user.id;
    const p = await get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN is_active = 1 AND is_unlimited = 0 THEN inventory ELSE 0 END) AS units
         FROM products WHERE seller_id = ?`, [s]);
    const o = await get(
      `SELECT COUNT(DISTINCT o.id) AS orders,
              COALESCE(SUM(oi.subtotal), 0) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.seller_id = ? AND o.payment_status = 'paid'`, [s]);
    const pending = await get(
      `SELECT COUNT(DISTINCT o.id) AS c FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.seller_id = ? AND o.status = 'processing'`, [s]);
    const low = await get(
      `SELECT COUNT(*) AS c FROM products
        WHERE seller_id = ? AND is_active = 1 AND is_unlimited = 0 AND inventory <= 3`, [s]);

    // revenue by month for the chart (last 6 months)
    const trend = await all(
      `SELECT strftime('%Y-%m', o.created_at) AS month, SUM(oi.subtotal) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.seller_id = ? AND o.payment_status = 'paid'
          AND o.created_at >= date('now', '-6 months')
        GROUP BY month ORDER BY month`, [s]);

    res.json({
      stats: {
        total_products: Number(p.total || 0),
        active_products: Number(p.active || 0),
        inventory_units: Number(p.units || 0),
        orders: Number(o.orders || 0),
        revenue: Math.round(Number(o.revenue || 0) * 100) / 100,
        pending_orders: Number(pending.c || 0),
        low_stock: Number(low.c || 0),
        trend: trend.map((t) => ({ month: t.month, revenue: Math.round(Number(t.revenue) * 100) / 100 })),
      },
    });
  } catch (err) { next(err); }
});

// ---------------- PRODUCTS ----------------
router.get('/products', async (req, res, next) => {
  try {
    const includeInactive = req.query.all === '1' ? '1' : '1'; // dashboard always shows all
    const rows = await all(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id
        WHERE p.seller_id = ?
        ORDER BY p.is_active DESC, p.created_at DESC`, [req.user.id]);
    res.json({ products: rows.map(shapeProduct), total: rows.length, includeInactive });
  } catch (err) { next(err); }
});

function validateProductInput(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = str(body.title);
    if (out.title.length < 3 || out.title.length > 120) errors.push('Title must be 3–120 characters.');
  } else { out.title = ''; }
  if (!partial || body.description !== undefined) {
    out.description = str(body.description);
    if (out.description.length < 10) errors.push('Description must be at least 10 characters.');
  } else { out.description = ''; }
  if (!partial || body.price !== undefined) {
    out.price = parseFloat(body.price);
    if (Number.isNaN(out.price) || out.price < 0 || out.price > 100000) errors.push('Price must be a valid amount.');
  } else { out.price = 0; }
  if (!partial || body.category !== undefined) {
    out.category = str(body.category);
    if (!out.category) errors.push('Please choose a category.');
  } else { out.category = ''; }
  if (!partial || body.product_type !== undefined) {
    out.product_type = str(body.product_type);
    if (!VALID_TYPES.includes(out.product_type)) errors.push('Product type must be handmade, vintage or digital.');
  } else { out.product_type = 'handmade'; }
  if (!partial || body.inventory !== undefined) {
    out.inventory = parseInt(body.inventory, 10);
    if (Number.isNaN(out.inventory) || out.inventory < 0) errors.push('Inventory must be 0 or more.');
  } else { out.inventory = 0; }
  if (body.images !== undefined) {
    let imgs = body.images;
    if (typeof imgs === 'string') {
      imgs = imgs.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(imgs)) imgs = [];
    out.images = JSON.stringify(imgs.slice(0, 6));
  }
  if (body.location !== undefined) out.location = str(body.location) || null;
  else out.location = null;
  if (body.is_featured !== undefined) out.is_featured = body.is_featured ? 1 : 0;
  if (body.is_trending !== undefined) out.is_trending = body.is_trending ? 1 : 0;
  if (body.is_active !== undefined) out.is_active = body.is_active ? 1 : 0;
  out.is_unlimited = body.is_unlimited ? 1 : 0;
  return { errors, out };
}

// CREATE
router.post('/products', async (req, res, next) => {
  try {
    const { errors, out } = validateProductInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const category = await get('SELECT slug FROM categories WHERE slug = ? OR name = ?', [out.category, out.category]);
    const categorySlug = category ? category.slug : out.category;
    const nowIso = new Date().toISOString();
    const images = out.images || JSON.stringify([]);

    const id = await insert(
      `INSERT INTO products
        (seller_id, title, description, price, category, product_type, images, inventory,
         is_unlimited, is_featured, is_trending, is_active, rating, review_count, location,
         created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?)`,
      [req.user.id, out.title, out.description, out.price, categorySlug, out.product_type,
       images, out.product_type === 'digital' ? 0 : out.inventory,
       out.is_unlimited ?? (out.product_type === 'digital' ? 1 : 0),
       out.is_featured ?? 0, out.is_trending ?? 0, out.is_active ?? 1,
       out.location, nowIso, nowIso]
    );
    if (out.inventory > 0 && out.product_type !== 'digital') {
      await insert(
        'INSERT INTO inventory_logs (product_id, seller_id, change_amount, reason, created_at) VALUES (?,?,?,?,?)',
        [id, req.user.id, out.inventory, 'Initial stock', nowIso]);
    }
    const row = await get(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id WHERE p.id = ?`, [id]);
    res.status(201).json({ product: shapeProduct(row), message: 'Product created' });
  } catch (err) { next(err); }
});

// UPDATE
router.put('/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });
    if (Number(existing.seller_id) !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own products.' });
    }
    const { errors, out } = validateProductInput(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const sets = [];
    const args = [];
    const allowed = ['title', 'description', 'price', 'category', 'product_type', 'images',
      'inventory', 'location', 'is_featured', 'is_trending', 'is_active', 'is_unlimited'];
    for (const key of allowed) {
      if (out[key] !== undefined) {
        let value = out[key];
        if (key === 'category') {
          const c = await get('SELECT slug FROM categories WHERE slug = ? OR name = ?', [value, value]);
          value = c ? c.slug : value;
        }
        sets.push(`${key} = ?`);
        args.push(value);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    sets.push('updated_at = ?');
    args.push(new Date().toISOString(), id);
    await run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, args);

    // inventory change → log it
    if (out.inventory !== undefined && out.inventory !== existing.inventory) {
      await insert(
        'INSERT INTO inventory_logs (product_id, seller_id, change_amount, reason, created_at) VALUES (?,?,?,?,?)',
        [id, req.user.id, out.inventory - existing.inventory, 'Edited by seller', new Date().toISOString()]);
    }
    const row = await get(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id WHERE p.id = ?`, [id]);
    res.json({ product: shapeProduct(row), message: 'Product updated' });
  } catch (err) { next(err); }
});

// INVENTORY UPDATE (increase / decrease / set)
router.patch('/products/:id/inventory', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });
    if (Number(existing.seller_id) !== req.user.id) {
      return res.status(403).json({ error: 'You can only manage your own inventory.' });
    }
    if (existing.is_unlimited) {
      return res.status(400).json({ error: 'This digital product has unlimited stock.' });
    }
    const mode = str(req.body.mode) || 'set';
    const value = parseInt(req.body.value, 10);
    if (Number.isNaN(value)) return res.status(400).json({ error: 'Please enter a number.' });

    let nextQty;
    if (mode === 'add') nextQty = existing.inventory + value;
    else if (mode === 'subtract') nextQty = existing.inventory - value;
    else nextQty = value;
    if (nextQty < 0) return res.status(400).json({ error: 'Inventory cannot go below zero.' });

    const nowIso = new Date().toISOString();
    await run('UPDATE products SET inventory = ?, updated_at = ? WHERE id = ?', [nextQty, nowIso, id]);
    await insert(
      'INSERT INTO inventory_logs (product_id, seller_id, change_amount, reason, created_at) VALUES (?,?,?,?,?)',
      [id, req.user.id, nextQty - existing.inventory, `Stock ${mode}`, nowIso]);

    res.json({ inventory: nextQty, message: `Inventory updated to ${nextQty}` });
  } catch (err) { next(err); }
});

// DELETE (deactivate — preserves order history)
router.delete('/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });
    if (Number(existing.seller_id) !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own products.' });
    }
    const hasOrders = await get('SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [id]);
    const nowIso = new Date().toISOString();
    if (hasOrders) {
      // keep row for order history, but hide it from the marketplace
      await run('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?', [nowIso, id]);
      await insert(
        'INSERT INTO inventory_logs (product_id, seller_id, change_amount, reason, created_at) VALUES (?,?,?,?,?)',
        [id, req.user.id, 0, 'Product deactivated (order history retained)', nowIso]);
      res.json({ removed: false, deactivated: true, message: 'Product removed from your shop (order history kept).' });
    } else {
      await run('DELETE FROM products WHERE id = ?', [id]);
      res.json({ removed: true, deactivated: false, message: 'Product deleted' });
    }
  } catch (err) { next(err); }
});

// RESTORE (un-publish → re-publish)
router.patch('/products/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await get('SELECT id, seller_id, is_active FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });
    if (Number(existing.seller_id) !== req.user.id) {
      return res.status(403).json({ error: 'You can only manage your own products.' });
    }
    const active = req.body.is_active ? 1 : 0;
    await run('UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?',
      [active, new Date().toISOString(), id]);
    res.json({ is_active: !!active, message: active ? 'Product listed' : 'Product unpublished' });
  } catch (err) { next(err); }
});

// INVENTORY LOG
router.get('/inventory-logs', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT l.*, p.title FROM inventory_logs l JOIN products p ON p.id = l.product_id
        WHERE l.seller_id = ? ORDER BY l.created_at DESC LIMIT 100`, [req.user.id]);
    res.json({ logs: rows });
  } catch (err) { next(err); }
});

export default router;
