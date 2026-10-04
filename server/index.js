/**
 * Craftly Marketplace — Express API server.
 * Serves the JSON API and, in production, the built React client.
 * Turso credentials live ONLY here (server-side), never in the browser.
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadUser } from './util.js';
import { db } from './db.js';
import { ensureDailyListings } from '../scripts/daily-listings.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes, { ensureCart } from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import { orders, wishlist } from './routes/orders.js';
import sellerRoutes from './routes/seller.js';
import profileRoutes from './routes/profile.js';
import shopRoutes from './routes/shops.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 8787;

// On Vercel the platform runs this file as a serverless function: there is no
// long-lived process, no writable filesystem and no port to bind. Locally we
// keep the same file as a normal HTTP server.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// simple request log (dev)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      }
    });
    next();
  });
}

// CORS for local dev (vite proxies /api, but allow direct access too)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(loadUser);

// ---------------- API ----------------
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orders);
app.use('/api/wishlist', wishlist);
app.use('/api/seller', sellerRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/shops', shopRoutes);

// cart count badge helper
app.get('/api/cart/count', async (req, res, next) => {
  try {
    if (!req.user) return res.json({ count: 0 });
    const cart = await ensureCart(req.user.id);
    const { get } = await import('./db.js');
    const row = await get('SELECT COALESCE(SUM(quantity),0) AS c FROM cart_items WHERE cart_id = ?', [cart.id]);
    res.json({ count: Number(row.c) });
  } catch (err) { next(err); }
});

// health / config check (never leaks secrets)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    db: process.env.TURSO_DATABASE_URL
      ? (process.env.TURSO_DATABASE_URL.startsWith('file:') ? 'libsql-file' : 'turso')
      : 'libsql-file (default)',
    time: new Date().toISOString(),
  });
});

// ---------------- Daily listing generator ----------------
// 15 category generators, each publishing 25 listings once per calendar day
// (375/day total), staggered through the day. Each (day, category) batch is
// claimed exactly once in the database, so this is safe to run constantly:
// locally it fires at boot and then every minute. Serverless instances are
// torn down between requests, so there the same work is driven by a Vercel
// cron hitting /api/cron/daily instead of an interval that would never tick.
let generatorBusy = false;
export async function runDailyGenerator() {
  if (generatorBusy) return { skipped: 'busy' };
  generatorBusy = true;
  try {
    const res = await ensureDailyListings(db);
    if (res.created > 0) console.log(`[daily-listings] ${res.day}: +${res.created} listings`);
    return res;
  } catch (err) {
    console.warn('[daily-listings] skipped:', err.message);
    return { error: err.message };
  } finally {
    generatorBusy = false;
  }
}

// Cron entry point (also usable manually). Protected by CRON_SECRET when set,
// because it writes to the database.
app.get('/api/cron/daily', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const result = await runDailyGenerator();
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

if (!IS_SERVERLESS) {
  runDailyGenerator();
  setInterval(runDailyGenerator, 60 * 1000);
}

// ---------------- Static client (production) ----------------
// On Vercel the CDN serves public/ and the Vite build, and vercel.json rewrites
// unknown paths to index.html — so the function only needs the API. Locally we
// serve both from one process.
if (!IS_SERVERLESS) {
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    // served BEFORE dist so freshly generated artwork is never stale
    app.use(express.static(publicDir));
  }
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
}

// ---------------- 404 + error handling ----------------
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[server error]', err);
  const status = err.status || 500;
  // Never expose raw DB errors / secrets to the client
  const message = status === 500
    ? 'Something went wrong on our side. Please try again.'
    : err.message;
  res.status(status).json({ error: message });
});

if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`\n  Craftly API listening on http://localhost:${PORT}`);
    console.log(`  Database: ${process.env.TURSO_DATABASE_URL || 'file:./data/craftly.db (local default)'}\n`);
  });
}

// Vercel serverless entry point: the platform imports this module and invokes
// the default export as the request handler.
export default app;
