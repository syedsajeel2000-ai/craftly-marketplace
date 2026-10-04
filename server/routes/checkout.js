/**
 * Checkout API — validates cart server-side, simulates a demo payment,
 * then atomically creates the order, order items, inventory updates and
 * clears the cart inside ONE libSQL transaction.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { db, get, all, run } from '../db.js';
import { requireAuth, str, isEmail } from '../util.js';
import { ensureCart, shapeCart } from './cart.js';

const router = Router();
router.use(requireAuth);

// ---------------- Demo payment validation ----------------
// No real money moves. Only obviously-invalid cards are rejected.
function validateDemoCard(card) {
  const number = str(card.number).replace(/[\s-]/g, '');
  const name = str(card.name);
  const expiry = str(card.expiry);
  const cvv = str(card.cvv);
  const method = str(card.method) || 'demo_card';

  if (method === 'demo_wallet') return { ok: true, method: 'demo_wallet' };

  if (!name || name.length < 2) return { ok: false, error: 'Please enter the cardholder name.' };
  if (!/^\d{13,19}$/.test(number)) return { ok: false, error: 'Please enter a valid card number (13–19 digits).' };
  const m = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return { ok: false, error: 'Expiry must be in MM/YY format.' };
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return { ok: false, error: 'Expiry month must be between 01 and 12.' };
  const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime();
  if (endOfMonth < Date.now()) return { ok: false, error: 'This card has expired.' };
  if (!/^\d{3,4}$/.test(cvv)) return { ok: false, error: 'CVV must be 3 or 4 digits.' };

  // Cards declared as declined in the demo rules (payment failure path)
  if (number.endsWith('0002') || number.startsWith('40000000000000')) {
    if (number.endsWith('0002')) return { ok: false, error: 'Your demo card was declined. Try another demo card.' };
  }
  return { ok: true, method: 'demo_card', last4: number.slice(-4) };
}

// ---------------- CHECKOUT ----------------
router.post('/', async (req, res, next) => {
  const tx = await db.transaction('write');
  try {
    const userId = req.user.id;
    const customer = req.body.customer || {};
    const shipping = req.body.shipping || {};
    const payment = req.body.payment || {};

    // ---- 1. Validate customer + shipping info ----
    const errors = [];
    const name = str(customer.name);
    const email = str(customer.email);
    const phone = str(customer.phone);
    if (!name || name.length < 2) errors.push('Full name is required.');
    if (!isEmail(email)) errors.push('A valid email address is required.');
    if (!/^[+()\d\s-]{7,20}$/.test(phone)) errors.push('A valid phone number is required.');
    if (!str(shipping.address) || str(shipping.address).length < 5) errors.push('Street address is required.');
    if (!str(shipping.city)) errors.push('City is required.');
    if (!str(shipping.postal)) errors.push('Postal code is required.');
    if (!str(shipping.country)) errors.push('Country is required.');
    if (errors.length) {
      await tx.rollback();
      return res.status(400).json({ error: errors[0], errors });
    }

    // ---- 2. Validate demo payment ----
    const pay = validateDemoCard(payment);
    if (!pay.ok) {
      await tx.rollback();
      return res.status(402).json({ error: pay.error, payment_failed: true });
    }

    // ---- 3. Re-read cart from the DB (never trust client totals) ----
    const cart = await ensureCart(userId);
    const rows = await all(
      `SELECT ci.id AS cart_item_id, ci.quantity, p.*
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id = ?`, [cart.id]);
    if (rows.length === 0) {
      await tx.rollback();
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    // ---- 4. Validate every item: exists, active, stock, price ----
    const problems = [];
    const items = rows.map((r) => {
      if (!r.is_active) problems.push(`"${r.title}" is no longer for sale.`);
      else if (!r.is_unlimited && r.inventory < r.quantity) {
        problems.push(r.inventory <= 0
          ? `"${r.title}" is sold out.`
          : `Only ${r.inventory} of "${r.title}" left in stock.`);
      }
      return {
        product_id: r.id,
        seller_id: r.seller_id,
        title: r.title,
        image: (() => { try { return JSON.parse(r.images || '[]')[0] || null; } catch { return null; } })(),
        quantity: r.quantity,
        unit_price: r.price,           // authoritative price from Turso
        subtotal: Math.round(r.price * r.quantity * 100) / 100,
        is_unlimited: !!r.is_unlimited,
        is_digital: r.product_type === 'digital',
      };
    });
    if (problems.length) {
      await tx.rollback();
      return res.status(409).json({ error: problems[0], cart_issues: problems });
    }

    // ---- 5. Totals (server-side) ----
    const subtotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
    const hasPhysical = items.some((i) => !i.is_digital);
    const shippingCost = hasPhysical ? (subtotal >= 50 ? 0 : 5.99) : 0;
    const total = Math.round((subtotal + shippingCost) * 100) / 100;

    // ---- 6. Create the order inside the transaction ----
    const orderNumber = 'CR-' + Date.now().toString(36).toUpperCase() + '-' +
      crypto.randomBytes(3).toString('hex').toUpperCase();
    const nowIso = new Date().toISOString();

    await tx.execute({
      sql: `INSERT INTO orders
              (order_number, user_id, total_amount, status, payment_status, payment_method,
               shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city,
               shipping_state, shipping_postal, shipping_country, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [orderNumber, userId, total, 'processing', 'paid', pay.method,
        name, email, phone, str(shipping.address), str(shipping.city),
        str(shipping.state), str(shipping.postal), str(shipping.country), nowIso, nowIso],
    });
    const idRes = await tx.execute('SELECT last_insert_rowid() AS id');
    const orderId = Number(idRes.rows[0].id);

    for (const item of items) {
      await tx.execute({
        sql: `INSERT INTO order_items
                (order_id, product_id, seller_id, title, image, quantity, unit_price, subtotal, created_at)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [orderId, item.product_id, item.seller_id, item.title, item.image,
          item.quantity, item.unit_price, item.subtotal, nowIso],
      });

      // ---- 7. Inventory: decrement physical stock + log it ----
      if (!item.is_unlimited) {
        await tx.execute({
          sql: 'UPDATE products SET inventory = inventory - ?, updated_at = ? WHERE id = ?',
          args: [item.quantity, nowIso, item.product_id],
        });
        await tx.execute({
          sql: `INSERT INTO inventory_logs (product_id, seller_id, change_amount, reason, created_at)
                VALUES (?,?,?,?,?)`,
          args: [item.product_id, item.seller_id, -item.quantity,
            `Order #${orderNumber}`, nowIso],
        });
      }
    }

    // ---- 8. Clear purchased items from the cart ----
    await tx.execute({ sql: 'DELETE FROM cart_items WHERE cart_id = ?', args: [cart.id] });
    await tx.execute({ sql: 'UPDATE carts SET updated_at = ? WHERE id = ?', args: [nowIso, cart.id] });

    await tx.commit();

    res.status(201).json({
      order: {
        id: orderId,
        order_number: orderNumber,
        total_amount: total,
        subtotal,
        shipping_cost: shippingCost,
        status: 'processing',
        payment_status: 'paid',
        payment_method: pay.method,
        created_at: nowIso,
        items: items.map(({ is_unlimited, is_digital, ...rest }) => rest),
        shipping: { ...shipping, name, email, phone },
      },
      message: 'Order confirmed',
    });
  } catch (err) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    console.error('[checkout]', err);
    res.status(500).json({ error: 'Checkout failed. Your card was not charged — please try again.' });
  }
});

export default router;
