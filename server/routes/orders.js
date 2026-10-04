/** Orders API (buyer history + seller view) and wishlist API. */
import { Router } from 'express';
import { all, get, insert, run } from '../db.js';
import { requireAuth, requireSeller, str } from '../util.js';

const ordersRouter = Router();
const wishRouter = Router();

// ---------------- ORDERS ----------------
ordersRouter.use(requireAuth);

/** Buyer: my orders */
ordersRouter.get('/', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id]);
    const orders = [];
    for (const o of rows) {
      const items = await all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [o.id]);
      orders.push(shapeOrder(o, items));
    }
    res.json({ orders });
  } catch (err) { next(err); }
});

/** Buyer: order detail — only the owner can read it */
ordersRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const order = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const items = await all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [id]);
    res.json({ order: shapeOrder(order, items) });
  } catch (err) { next(err); }
});

/** Seller: orders containing my products (their own line items only) */
ordersRouter.get('/seller/all', requireSeller, async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT o.*, oi.id AS item_id, oi.product_id, oi.title, oi.image, oi.quantity,
              oi.unit_price, oi.subtotal, oi.created_at AS item_created_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE oi.seller_id = ?
        ORDER BY o.created_at DESC`, [req.user.id]);

    // group by order
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.id)) {
        map.set(r.id, {
          id: r.id, order_number: r.order_number, status: r.status,
          payment_status: r.payment_status, created_at: r.created_at,
          customer_name: r.shipping_name, customer_city: r.shipping_city,
          items: [], revenue: 0,
        });
      }
      const order = map.get(r.id);
      order.items.push({
        id: r.item_id, product_id: r.product_id, title: r.title, image: r.image,
        quantity: r.quantity, unit_price: r.unit_price, subtotal: r.subtotal,
      });
      order.revenue += r.subtotal;
    }
    const orders = [...map.values()].map((o) => ({ ...o, revenue: Math.round(o.revenue * 100) / 100 }));
    res.json({ orders });
  } catch (err) { next(err); }
});

function shapeOrder(o, items) {
  return {
    id: o.id,
    order_number: o.order_number,
    user_id: o.user_id,
    total_amount: o.total_amount,
    status: o.status,
    payment_status: o.payment_status,
    payment_method: o.payment_method,
    created_at: o.created_at,
    updated_at: o.updated_at,
    shipping: {
      name: o.shipping_name, email: o.shipping_email, phone: o.shipping_phone,
      address: o.shipping_address, city: o.shipping_city, state: o.shipping_state,
      postal: o.shipping_postal, country: o.shipping_country,
    },
    items: items.map((i) => ({
      id: i.id, product_id: i.product_id, title: i.title, image: i.image,
      quantity: i.quantity, unit_price: i.unit_price, subtotal: i.subtotal,
      seller_id: i.seller_id,
    })),
  };
}

// ---------------- WISHLIST ----------------
wishRouter.use(requireAuth);

wishRouter.get('/', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT w.id AS wishlist_id, w.created_at AS saved_at, p.*,
              s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM wishlist w
         JOIN products p ON p.id = w.product_id
         JOIN users s ON s.id = p.seller_id
        WHERE w.user_id = ? AND p.is_active = 1
        ORDER BY w.created_at DESC`, [req.user.id]);
    res.json({
      wishlist: rows.map((r) => {
        let images = [];
        try { images = JSON.parse(r.images || '[]'); } catch { images = []; }
        return {
          wishlist_id: r.wishlist_id,
          saved_at: r.saved_at,
          id: r.id, title: r.title, price: r.price, images,
          rating: r.rating, review_count: r.review_count,
          category: r.category, product_type: r.product_type,
          inventory: r.inventory, is_unlimited: !!r.is_unlimited,
          seller_name: r.seller_name, seller_username: r.seller_username,
          seller_avatar: r.seller_avatar,
          in_stock: r.is_unlimited ? true : r.inventory > 0,
        };
      }),
    });
  } catch (err) { next(err); }
});

/** Toggle a product in the wishlist. Returns the new state. */
wishRouter.post('/:productId', async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const product = await get('SELECT id FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const existing = await get('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
      [req.user.id, productId]);
    if (existing) {
      await run('DELETE FROM wishlist WHERE id = ?', [existing.id]);
      return res.json({ wishlisted: false, message: 'Removed from wishlist' });
    }
    await insert('INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?,?,?)',
      [req.user.id, productId, new Date().toISOString()]);
    res.json({ wishlisted: true, message: 'Added to wishlist' });
  } catch (err) { next(err); }
});

wishRouter.delete('/:productId', async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    await run('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, productId]);
    res.json({ wishlisted: false, message: 'Removed from wishlist' });
  } catch (err) { next(err); }
});

export { ordersRouter as orders, wishRouter as wishlist };
