/** Products API: listing (search/filter/sort), detail, reviews, categories, home. */
import { Router } from 'express';
import { all, get, insert, run } from '../db.js';
import { requireAuth, str } from '../util.js';

const router = Router();

const SORTS = {
  recommended: 'p.is_featured DESC, p.rating DESC, p.review_count DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  rating: 'p.rating DESC, p.review_count DESC',
  trending: 'p.is_trending DESC, p.rating DESC, p.created_at DESC',
};

const PRICE_RANGES = {
  under25: [0, 25],
  '25-50': [25, 50],
  '50-100': [50, 100],
  over100: [100, null],
};

// "Handmade", "Vintage" and "Digital Products" are both categories and
// product types — matching either keeps these category pages full.
const CATEGORY_TYPE = { handmade: 'handmade', vintage: 'vintage', 'digital-products': 'digital' };

// SQL predicate usable in JOIN ... ON clauses for category product counts.
function categoryJoinCondition(alias = 'p', catAlias = 'c') {
  return `(${alias}.category = ${catAlias}.slug
    OR (${catAlias}.slug = 'handmade' AND ${alias}.product_type = 'handmade')
    OR (${catAlias}.slug = 'vintage' AND ${alias}.product_type = 'vintage')
    OR (${catAlias}.slug = 'digital-products' AND ${alias}.product_type = 'digital'))`;
}

function buildProductFilters(q) {
  const where = ['p.is_active = 1'];
  const args = [];

  const term = str(q.q);
  if (term) {
    // Search title, description, category and seller name/username
    where.push(`(
      p.title LIKE ? OR p.description LIKE ? OR p.category LIKE ?
      OR p.product_type LIKE ? OR EXISTS (
        SELECT 1 FROM users s WHERE s.id = p.seller_id
        AND (s.name LIKE ? OR s.username LIKE ?)
      )
    )`);
    const like = `%${term}%`;
    args.push(like, like, like, like, like, like);
  }

  if (q.category) {
    const type = CATEGORY_TYPE[q.category];
    if (type) {
      where.push('(p.category = ? OR p.product_type = ?)');
      args.push(str(q.category), type);
    } else {
      where.push('p.category = ?');
      args.push(str(q.category));
    }
  }
  if (q.type) { where.push('p.product_type = ?'); args.push(str(q.type)); }

  if (q.price && PRICE_RANGES[q.price]) {
    const [min, max] = PRICE_RANGES[q.price];
    if (min !== null && min !== undefined && min > 0) { where.push('p.price >= ?'); args.push(min); }
    if (max !== null && max !== undefined) { where.push('p.price <= ?'); args.push(max); }
  }
  const min = parseFloat(q.minPrice);
  const max = parseFloat(q.maxPrice);
  if (!Number.isNaN(min)) { where.push('p.price >= ?'); args.push(min); }
  if (!Number.isNaN(max)) { where.push('p.price <= ?'); args.push(max); }

  const rating = parseFloat(q.rating);
  if (!Number.isNaN(rating) && rating > 0) { where.push('p.rating >= ?'); args.push(rating); }

  if (q.availability === 'in') where.push('(p.inventory > 0 OR p.is_unlimited = 1)');
  if (q.seller) { where.push('(s.username = ? OR s.id = ?)'); args.push(str(q.seller), Number(q.seller) || 0); }

  return { where: where.join(' AND '), args };
}

// ---------- LIST / SEARCH / FILTER / SORT ----------
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    const { where, args } = buildProductFilters(req.query);
    const orderBy = SORTS[str(req.query.sort)] || SORTS.recommended;

    const countRow = await get(
      `SELECT COUNT(*) AS c FROM products p JOIN users s ON s.id = p.seller_id WHERE ${where}`, args
    );
    const rows = await all(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );
    res.json({
      products: rows.map(shapeProduct),
      total: Number(countRow.c),
      page,
      pages: Math.ceil(Number(countRow.c) / limit),
    });
  } catch (err) { next(err); }
});

// ---------- FEATURED / TRENDING / SECTION FEEDS ----------
const SECTIONS = {
  featured: 'p.is_featured = 1',
  trending: 'p.is_trending = 1',
  handmade: "p.product_type = 'handmade'",
  vintage: "p.product_type = 'vintage'",
  digital: "p.product_type = 'digital'",
  newest: '1=1',
};

router.get('/section/:section', async (req, res, next) => {
  try {
    const cond = SECTIONS[req.params.section];
    if (!cond) return res.status(404).json({ error: 'Unknown section.' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 30);
    const orderBy = req.params.section === 'newest' ? 'p.created_at DESC' : SORTS.recommended;
    const rows = await all(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id
        WHERE p.is_active = 1 AND ${cond}
        ORDER BY ${orderBy} LIMIT ?`, [limit]);
    res.json({ products: rows.map(shapeProduct) });
  } catch (err) { next(err); }
});

export function shapeProduct(row) {
  if (!row) return null;
  let images = [];
  try { images = JSON.parse(row.images || '[]'); } catch { images = []; }
  return {
    id: row.id,
    seller_id: row.seller_id,
    seller_name: row.seller_name,
    seller_username: row.seller_username,
    seller_avatar: row.seller_avatar,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category,
    product_type: row.product_type,
    images,
    inventory: row.inventory,
    is_unlimited: !!row.is_unlimited,
    rating: row.rating,
    review_count: row.review_count,
    is_featured: !!row.is_featured,
    is_trending: !!row.is_trending,
    is_active: !!row.is_active,
    location: row.location || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    in_stock: row.is_unlimited ? true : row.inventory > 0,
  };
}

// ---------- CATEGORIES ----------
router.get('/meta/categories', async (_req, res, next) => {
  try {
    const rows = await all(`
      SELECT c.*, COUNT(p.id) AS product_count
        FROM categories c
        LEFT JOIN products p ON ${categoryJoinCondition()} AND p.is_active = 1
       GROUP BY c.id ORDER BY c.id`);
    res.json({
      categories: rows.map((r) => ({
        id: r.id, name: r.name, slug: r.slug, description: r.description,
        image: r.image, product_count: Number(r.product_count),
      })),
    });
  } catch (err) { next(err); }
});

// ---------- HOMEPAGE ----------
router.get('/meta/home', async (_req, res, next) => {
  try {
    const q = async (cond, limit = 8, order = SORTS.recommended) =>
      (await all(
        `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
           FROM products p JOIN users s ON s.id = p.seller_id
          WHERE p.is_active = 1 AND ${cond} ORDER BY ${order} LIMIT ?`, [limit]
      )).map(shapeProduct);

    const categories = (await all(`
      SELECT c.*, COUNT(p.id) AS product_count
        FROM categories c
        LEFT JOIN products p ON ${categoryJoinCondition()} AND p.is_active = 1
       GROUP BY c.id ORDER BY c.id`))
      .map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description, image: r.image, product_count: Number(r.product_count) }));

    const stats = await get(`
      SELECT (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
             (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
             (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS orders`);

    res.json({
      featured: await q('p.is_featured = 1', 8),
      trending: await q('p.is_trending = 1', 8),
      handmade: await q("p.product_type = 'handmade'", 8),
      vintage: await q("p.product_type = 'vintage'", 8),
      digital: await q("p.product_type = 'digital'", 8),
      newest: await q('1=1', 8, 'p.created_at DESC'),
      categories,
      stats: {
        products: Number(stats.products),
        sellers: Number(stats.sellers),
        orders: Number(stats.orders),
      },
    });
  } catch (err) { next(err); }
});

// ---------- DETAIL ----------
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id.' });
    const row = await get(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar,
              s.bio AS seller_bio, s.created_at AS seller_since
         FROM products p JOIN users s ON s.id = p.seller_id WHERE p.id = ?`, [id]);
    if (!row) return res.status(404).json({ error: 'Product not found.' });
    // Hidden from the marketplace once deactivated — only its owner may view it.
    if (!row.is_active && (!req.user || (req.user.id !== row.seller_id && req.user.role !== 'admin'))) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = shapeProduct(row);
    product.seller_bio = row.seller_bio;
    product.seller_since = row.seller_since;

    const reviews = await all(
      `SELECT r.*, u.name AS reviewer_name, u.avatar AS reviewer_avatar
         FROM product_reviews r JOIN users u ON u.id = r.user_id
        WHERE r.product_id = ? ORDER BY r.created_at DESC`, [id]);
    product.reviews = reviews.map((r) => ({
      id: r.id, rating: r.rating, review_text: r.review_text,
      reviewer_name: r.reviewer_name, reviewer_avatar: r.reviewer_avatar,
      created_at: r.created_at,
    }));

    const related = await all(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id
        WHERE p.is_active = 1 AND p.id != ? AND (p.category = ? OR p.product_type = ?)
        ORDER BY p.rating DESC LIMIT 6`, [id, row.category, row.product_type]);
    product.related = related.map(shapeProduct);

    // viewer flags
    product.wishlisted = false;
    if (req.user) {
      product.wishlisted = !!(await get(
        'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, id]));
      product.purchased = !!(await get(
        `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = ? AND o.user_id = ? AND o.payment_status = 'paid' LIMIT 1`,
        [id, req.user.id]));
      const owned = await get('SELECT id FROM products WHERE id = ? AND seller_id = ?', [id, req.user.id]);
      product.is_own = !!owned;
    }

    res.json({ product });
  } catch (err) { next(err); }
});

// ---------- RELATED ----------
router.get('/:id/related', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const base = await get('SELECT category, product_type FROM products WHERE id = ?', [id]);
    if (!base) return res.status(404).json({ error: 'Product not found.' });
    const rows = await all(
      `SELECT p.*, s.name AS seller_name, s.username AS seller_username, s.avatar AS seller_avatar
         FROM products p JOIN users s ON s.id = p.seller_id
        WHERE p.is_active = 1 AND p.id != ? AND (p.category = ? OR p.product_type = ?)
        ORDER BY p.rating DESC LIMIT 6`, [id, base.category, base.product_type]);
    res.json({ products: rows.map(shapeProduct) });
  } catch (err) { next(err); }
});

// ---------- REVIEWS (create) ----------
router.post('/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const rating = parseInt(req.body.rating, 10);
    const text = str(req.body.review_text).slice(0, 2000);

    const product = await get('SELECT id FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Please choose a rating between 1 and 5.' });
    }
    if (!text) return res.status(400).json({ error: 'Please write a few words about your purchase.' });

    // Restrict reviews to buyers who actually purchased (paid order) this product
    const purchased = await get(
      `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = ? AND o.user_id = ? AND o.payment_status = 'paid' LIMIT 1`,
      [productId, req.user.id]);
    if (!purchased) {
      return res.status(403).json({ error: 'You can only review products you have purchased.' });
    }

    const existing = await get(
      'SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?', [productId, req.user.id]);
    const nowIso = new Date().toISOString();
    if (existing) {
      await run('UPDATE product_reviews SET rating = ?, review_text = ?, updated_at = ? WHERE id = ?',
        [rating, text, nowIso, existing.id]);
    } else {
      await insert(
        `INSERT INTO product_reviews (product_id, user_id, rating, review_text, created_at, updated_at)
         VALUES (?,?,?,?,?,?)`, [productId, req.user.id, rating, text, nowIso, nowIso]);
    }

    await run(`
      UPDATE products SET
        rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = ?), 0),
        review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = ?),
        updated_at = ?
      WHERE id = ?`, [productId, productId, nowIso, productId]);

    const updated = await get(
      'SELECT rating, review_count FROM products WHERE id = ?', [productId]);
    res.status(201).json({
      ok: true,
      rating: updated.rating,
      review_count: Number(updated.review_count),
      message: existing ? 'Review updated.' : 'Review posted.',
    });
  } catch (err) { next(err); }
});

export default router;
