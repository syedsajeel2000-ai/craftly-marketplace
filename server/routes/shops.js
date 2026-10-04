/** Public shop profiles: everything a visitor needs to browse one seller's storefront. */
import { Router } from 'express';
import { all, get } from '../db.js';
import { shapeProduct } from './products.js';

const router = Router();

const SORTS = {
  recommended: 'p.is_featured DESC, p.rating DESC, p.review_count DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  rating: 'p.rating DESC, p.review_count DESC',
};

const PAGE_SIZE = 24;

/**
 * GET /api/shops — the seller directory.
 * Powers the /shops page so all the shops are browsable, not just reachable
 * by clicking a name on a listing.
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60);
    const q = String(req.query.q || '').trim().toLowerCase();
    const offset = (page - 1) * perPage;

    const where = ["u.role = 'seller'"];
    const args = [];
    if (q) {
      where.push('(LOWER(u.name) LIKE ? OR LOWER(u.username) LIKE ?)');
      args.push(`%${q}%`, `%${q}%`);
    }
    const cond = where.join(' AND ');

    const countRow = await get(`SELECT COUNT(*) AS c FROM users u WHERE ${cond}`, args);
    const total = Number(countRow.c);

    const rows = await all(
      `SELECT u.username, u.name, u.avatar, u.bio,
              (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id AND p.is_active = 1) AS listings,
              (SELECT COALESCE(ROUND(AVG(r.rating), 1), 0) FROM product_reviews r
                 JOIN products p2 ON p2.id = r.product_id WHERE p2.seller_id = u.id) AS rating,
              (SELECT COUNT(*) FROM product_reviews r2
                 JOIN products p3 ON p3.id = r2.product_id WHERE p3.seller_id = u.id) AS review_count,
              (SELECT MIN(p4.location) FROM products p4
                WHERE p4.seller_id = u.id AND p4.is_active = 1 AND p4.location IS NOT NULL) AS location
         FROM users u WHERE ${cond}
        ORDER BY listings DESC, rating DESC, u.name ASC
        LIMIT ? OFFSET ?`,
      [...args, perPage, offset]);

    res.json({
      shops: rows.map((r) => ({
        username: r.username,
        name: r.name,
        avatar: r.avatar,
        bio: r.bio,
        location: r.location || null,
        listings: Number(r.listings),
        rating: Number(r.rating),
        review_count: Number(r.review_count),
      })),
      total,
      page,
      pages: Math.ceil(total / perPage) || 1,
      q,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/shops/:username
 * Seller profile + a page of their active listings. Public: no auth needed,
 * and never leaks the seller's email or any private account field.
 */
router.get('/:username', async (req, res, next) => {
  try {
    const username = String(req.params.username || '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'Missing shop name.' });

    const seller = await get(
      `SELECT u.id, u.name, u.username, u.avatar, u.bio, u.created_at
         FROM users u
        WHERE u.username = ? AND u.role = 'seller'`, [username]);
    if (!seller) return res.status(404).json({ error: 'Shop not found.' });

    const sort = SORTS[req.query.sort] || SORTS.recommended;
    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // Only listings that are actually in the marketplace are counted or shown.
    const stats = await get(
      `SELECT COUNT(*) AS listings,
              COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_listings,
              COALESCE(SUM(CASE WHEN inventory > 0 OR is_unlimited = 1 THEN 1 ELSE 0 END), 0) AS in_stock
         FROM products WHERE seller_id = ?`, [seller.id]);

    const reviews = await get(
      `SELECT COUNT(*) AS count, COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg
         FROM product_reviews r
         JOIN products p ON p.id = r.product_id
        WHERE p.seller_id = ?`, [seller.id]);

    const rows = await all(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id
        WHERE p.seller_id = ? AND p.is_active = 1
        ORDER BY ${sort}
        LIMIT ? OFFSET ?`, [seller.id, PAGE_SIZE, offset]);

    // Counts per category, for the shop's own category chips.
    const cats = await all(
      `SELECT category, COUNT(*) AS product_count
         FROM products WHERE seller_id = ? AND is_active = 1
        GROUP BY category ORDER BY product_count DESC, category`, [seller.id]);

    const activeListings = Number(stats.active_listings);
    res.json({
      seller: {
        name: seller.name,
        username: seller.username,
        avatar: seller.avatar,
        bio: seller.bio,
        member_since: seller.created_at,
        listings: activeListings,
        total_listings: Number(stats.listings),
        in_stock: Number(stats.in_stock),
        review_count: Number(reviews.count),
        rating: Number(reviews.avg),
      },
      categories: cats.map((c) => ({ slug: c.category, product_count: Number(c.product_count) })),
      products: rows.map(shapeProduct),
      page,
      page_size: PAGE_SIZE,
      total: activeListings,
      has_more: offset + rows.length < activeListings,
    });
  } catch (err) { next(err); }
});

export default router;
