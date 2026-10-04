/**
 * Point every listing at real product photographs.
 *
 * The catalog was originally filled with generated abstract artwork
 * (public/images/products/*.svg). This replaces those URLs with real
 * Creative-Commons photographs downloaded by scripts/fetch-photos.mjs into
 * public/images/photos/, choosing three per listing from the pool for that
 * listing's own category — so a ring listing shows rings, a mug listing shows
 * mugs.
 *
 * Photos are rotated per listing (deterministically by product id) and chosen
 * without immediate repeats, so a category with only 15 photos still looks
 * varied across hundreds of listings instead of showing the same three.
 *
 * Usage:
 *   npm run db:photos            # download the photos first
 *   npm run db:assign-photos     # rewrite products.images
 *   LIMIT=50 npm run db:assign-photos   # trial run on the first 50 listings
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeClient } from './migrate.js';
import { loadPhotoPools, poolFor } from './photo-pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const MANIFEST = path.join(root, 'public', 'images', 'photos', 'manifest.json');
const PHOTOS_PER_LISTING = 3;

const db = makeClient();
/** photo path -> Openverse title, for relevance ranking. */
const manifestTitles = new Map();
const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Deterministic PRNG so a re-run produces the same assignment. */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Three distinct photo paths for one listing. Walks the pool from a seeded
 * offset, which keeps consecutive listings in a category from repeating the
 * same leading photo.
 */
function pickPhotos(pool, seed, count = PHOTOS_PER_LISTING) {
  if (!pool.length) return null;
  const rand = rng(seed);
  const start = Math.floor(rand() * pool.length);
  const out = [];
  for (let i = 0; out.length < Math.min(count, pool.length) && i < pool.length; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}

/** Score a photo by how much its Openverse title overlaps the listing title. */
function matchesTitle(photoPath, title) {
  const photo = manifestTitles.get(photoPath);
  if (!photo) return 0;
  const t = title.toLowerCase();
  const words = String(photo).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  // Only meaningful when the Openverse title actually describes the subject.
  let hits = 0;
  for (const w of words) if (t.includes(w)) hits++;
  return hits;
}

async function main() {
  const limit = Number(process.env.LIMIT) || 0;

  const rows = (await db.execute(
    `SELECT id, title, category, images FROM products ${limit ? `ORDER BY id LIMIT ${limit}` : ''}`
  )).rows;

  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    console.error(`No photo manifest at ${path.relative(root, MANIFEST)} — run "npm run db:photos" first.`);
    process.exitCode = 1;
    db.close();
    return;
  }
  await loadPhotoPools();
  for (const p of manifest.photos || []) manifestTitles.set(p.file, p.title);

  const missing = [];
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  }

  const updates = [];
  for (const [category, group] of byCategory) {
    const pool = poolFor(category);
    if (!pool.length) { missing.push(category); continue; }

    // Prefer photos whose Openverse title names something in the listing
    // title, then walk on from a seeded offset so neighbouring listings in the
    // same category don't all open with the same photo. `pool` holds file
    // paths (see scripts/photo-pool.js).
    group.sort((a, b) => Number(a.id) - Number(b.id));
    group.forEach((row, i) => {
      const sorted = [...pool].sort((a, b) => matchesTitle(b, row.title) - matchesTitle(a, row.title));
      const files = pickPhotos(sorted, hashStr(`${category}#${row.id}`));
      if (!files || files.some((f) => !f)) return;
      const current = JSON.parse(row.images || '[]');
      if (JSON.stringify(current) === JSON.stringify(files)) return;
      updates.push({ sql: 'UPDATE products SET images = ? WHERE id = ?', args: [JSON.stringify(files), Number(row.id)] });
      if ((i + 1) % 500 === 0) process.stdout.write(`\r  ${category}: ${i + 1}/${group.length}`);
    });
    process.stdout.write(`\r  ${category}: ${group.length}/${group.length}                    \n`);
  }

  const CHUNK = 200;
  // Refuse to write anything malformed — a silent [null,null,null] would look
  // like a successful migration and render as broken images everywhere.
  for (const u of updates) {
    const list = JSON.parse(u.args[0]);
    if (list.length !== PHOTOS_PER_LISTING || list.some((f) => typeof f !== 'string' || !f.startsWith('/images/photos/'))) {
      throw new Error(`Refusing to write bad image list: ${u.args[0]}`);
    }
  }
  for (let i = 0; i < updates.length; i += CHUNK) {
    await db.batch(updates.slice(i, i + CHUNK), 'write');
  }

  const left = await db.execute(
    `SELECT COUNT(*) AS c FROM products WHERE images LIKE '%/images/products/%'`);
  console.log(`  ${updates.length} of ${rows.length} listings now use real photographs`);
  console.log(`  ${Number(left.rows[0].c)} listings still on generated artwork`);
  if (missing.length) console.log(`  no photo pool for: ${missing.join(', ')}`);
  console.log(`  credits: public/images/photos/CREDITS.md`);
  if (missing.length) process.exitCode = 1;
  db.close();
}

main().catch((err) => {
  console.error('Assign photos failed:', err.message);
  process.exitCode = 1;
  db.close();
});
