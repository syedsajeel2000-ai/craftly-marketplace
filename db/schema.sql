-- =============================================================
-- Craftly Marketplace — Turso (libSQL) schema
-- Dialect: SQLite / libSQL
-- Applied by scripts/migrate.js (tracked in `_migrations`)
-- =============================================================

PRAGMA foreign_keys = ON;

-- ---------------- USERS ----------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'buyer'
                CHECK (role IN ('buyer', 'seller', 'admin')),
  avatar        TEXT,
  bio           TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------- SESSIONS ----------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  token        TEXT    NOT NULL UNIQUE,
  user_agent   TEXT,
  expires_at   TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- ---------------- CATEGORIES ----------------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  image       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------- PRODUCTS ----------------
CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id    INTEGER NOT NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  price        REAL    NOT NULL CHECK (price >= 0),
  category     TEXT    NOT NULL,
  product_type TEXT    NOT NULL CHECK (product_type IN ('handmade', 'vintage', 'digital')),
  images       TEXT    NOT NULL DEFAULT '[]',      -- JSON array of image URLs
  inventory    INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),
  is_unlimited INTEGER NOT NULL DEFAULT 0,         -- digital goods: 1 = unlimited stock
  rating       REAL    NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  is_featured  INTEGER NOT NULL DEFAULT 0,
  is_trending  INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  location     TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_seller   ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_type     ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(is_active);

-- ---------------- CARTS ----------------
CREATE TABLE IF NOT EXISTS carts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id    INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price      REAL    NOT NULL,                    -- snapshot at add-time (revalidated server-side)
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cart_id, product_id),
  FOREIGN KEY (cart_id)    REFERENCES carts(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- ---------------- ORDERS ----------------
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number   TEXT    NOT NULL UNIQUE,
  user_id        INTEGER NOT NULL,
  total_amount   REAL    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method TEXT    DEFAULT 'demo_card',
  shipping_name    TEXT,
  shipping_email   TEXT,
  shipping_phone   TEXT,
  shipping_address TEXT,
  shipping_city    TEXT,
  shipping_state   TEXT,
  shipping_postal  TEXT,
  shipping_country TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  seller_id  INTEGER NOT NULL,
  title      TEXT    NOT NULL,                    -- snapshot: survives product deletion
  image      TEXT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL    NOT NULL,
  subtotal   REAL    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (seller_id)  REFERENCES users(id)    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller  ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ---------------- REVIEWS ----------------
CREATE TABLE IF NOT EXISTS product_reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, user_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

-- ---------------- WISHLIST ----------------
CREATE TABLE IF NOT EXISTS wishlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- ---------------- INVENTORY LOGS ----------------
CREATE TABLE IF NOT EXISTS inventory_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  seller_id     INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,
  reason        TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id)  REFERENCES users(id)    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inv_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_logs_seller  ON inventory_logs(seller_id);
