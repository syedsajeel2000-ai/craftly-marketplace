/** Cart API — server-authoritative quantities, prices and totals. */
import { Router } from 'express';
import { all, get, insert, run } from '../db.js';
import { requireAuth } from '../util.js';

const router = Router();
router.use(requireAuth);

/** Loads the user's cart row, creating it lazily. */
async function ensureCart(userId) {
  let cart = await get('SELECT * FROM carts WHERE user_id = ?', [userId]);
  if (!cart) {
    const id = await insert('INSERT INTO carts (user_id, created_at, updated_at) VALUES (?,?,?)',
      [userId, new Date().toISOString(), new Date().toISOString()]);
    cart = await get('SELECT * FROM carts WHERE id = ?', [id]);
  }
  return cart;
}

/** Shapes a cart with server-computed totals (never trust client prices). */
export async function shapeCart(cartId) {
  const rows = await all(
    `SELECT ci.id, ci.quantity, ci.price AS added_price, ci.created_at,
            p.id AS product_id, p.title, p.price, p.images, p.inventory, p.is_unlimited,
            p.is_active, p.category, p.product_type, p.seller_id,
            s.name AS seller_name, s.username AS seller_username
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN users s ON s.id = p.seller_id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at DESC`, [cartId]);

  const items = rows.map((r) => {
    let images = [];
    try { images = JSON.parse(r.images || '[]'); } catch { images = []; }
    const available = r.is_unlimited ? true : r.inventory > 0;
    return {
      id: r.id,
      product_id: r.product_id,
      title: r.title,
      price: r.price,
      added_price: r.added_price,
      image: images[0] || null,
      quantity: r.quantity,
      inventory: r.inventory,
      is_unlimited: !!r.is_unlimited,
      is_active: !!r.is_active,
      category: r.category,
      product_type: r.product_type,
      seller_id: r.seller_id,
      seller_name: r.seller_name,
      seller_username: r.seller_username,
      in_stock: available,
      subtotal: Math.round(r.price * r.quantity * 100) / 100,
      max_qty: r.is_unlimited ? 99 : r.inventory,
      issues: !r.is_active
        ? ['This product is no longer available.']
        : !available
          ? ['Out of stock']
          : r.quantity > r.inventory && !r.is_unlimited
            ? [`Only ${r.inventory} left in stock`]
            : [],
    };
  });

  const subtotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const hasDigital = items.some((i) => i.product_type === 'digital');
  const hasPhysical = items.some((i) => i.product_type !== 'digital');
  const shipping = hasPhysical ? (subtotal >= 50 || subtotal === 0 ? 0 : 5.99) : 0;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  return {
    id: cartId, items, subtotal, shipping, total, itemCount,
    hasDigital, hasPhysical,
    has_issues: items.some((i) => i.issues.length > 0),
  };
}

// ---------- GET CART ----------
router.get('/', async (req, res, next) => {
  try {
    const cart = await ensureCart(req.user.id);
    res.json({ cart: await shapeCart(cart.id) });
  } catch (err) { next(err); }
});

// ---------- ADD ITEM ----------
router.post('/items', async (req, res, next) => {
  try {
    const productId = Number(req.body.product_id);
    const qty = Math.max(parseInt(req.body.quantity, 10) || 1, 1);
    if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid product.' });

    const product = await get('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!product) return res.status(404).json({ error: 'This product is no longer available.' });
    if (!product.is_unlimited && product.inventory < qty) {
      return res.status(409).json({
        error: product.inventory <= 0
          ? 'Sorry, this item is sold out.'
          : `Only ${product.inventory} left in stock.`,
      });
    }
    if (product.seller_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot add your own product to the cart.' });
    }

    const cart = await ensureCart(req.user.id);
    const existing = await get('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cart.id, productId]);
    const nowIso = new Date().toISOString();
    const newQty = (existing ? existing.quantity : 0) + qty;
    if (!product.is_unlimited && newQty > product.inventory) {
      return res.status(409).json({ error: `Only ${product.inventory} left in stock.` });
    }

    if (existing) {
      await run('UPDATE cart_items SET quantity = ?, price = ?, updated_at = ? WHERE id = ?',
        [newQty, product.price, nowIso, existing.id]);
    } else {
      await insert('INSERT INTO cart_items (cart_id, product_id, quantity, price, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        [cart.id, productId, newQty, product.price, nowIso, nowIso]);
    }
    await run('UPDATE carts SET updated_at = ? WHERE id = ?', [nowIso, cart.id]);
    res.status(201).json({ cart: await shapeCart(cart.id), message: 'Added to cart' });
  } catch (err) { next(err); }
});

// ---------- UPDATE QUANTITY ----------
router.patch('/items/:productId', async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const qty = parseInt(req.body.quantity, 10);
    const cart = await ensureCart(req.user.id);
    const item = await get(
      'SELECT ci.*, p.inventory, p.is_unlimited, p.is_active, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ? AND ci.product_id = ?',
      [cart.id, productId]);
    if (!item) return res.status(404).json({ error: 'Item not found in your cart.' });

    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1.' });
    }
    if (!item.is_unlimited && qty > item.inventory) {
      return res.status(409).json({ error: `Only ${item.inventory} left in stock.` });
    }
    const nowIso = new Date().toISOString();
    await run('UPDATE cart_items SET quantity = ?, price = ?, updated_at = ? WHERE id = ?',
      [qty, item.price, nowIso, item.id]);
    await run('UPDATE carts SET updated_at = ? WHERE id = ?', [nowIso, cart.id]);
    res.json({ cart: await shapeCart(cart.id) });
  } catch (err) { next(err); }
});

// ---------- REMOVE ITEM ----------
router.delete('/items/:productId', async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const cart = await ensureCart(req.user.id);
    await run('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, productId]);
    await run('UPDATE carts SET updated_at = ? WHERE id = ?', [new Date().toISOString(), cart.id]);
    res.json({ cart: await shapeCart(cart.id), message: 'Removed from cart' });
  } catch (err) { next(err); }
});

// ---------- CLEAR CART ----------
router.delete('/', async (req, res, next) => {
  try {
    const cart = await ensureCart(req.user.id);
    await run('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    res.json({ cart: await shapeCart(cart.id), message: 'Cart cleared' });
  } catch (err) { next(err); }
});

export default router;
export { ensureCart };
