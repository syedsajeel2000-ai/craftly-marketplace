/**
 * Shared access to the downloaded photo pool (public/images/photos/manifest.json).
 *
 * Both scripts/assign-photos.js (retro-fitting the existing catalog) and
 * scripts/daily-listings.js (brand-new listings as they are generated) ask the
 * same question: "which real photographs should this listing show?". Keeping
 * the lookup here means both paths stay in sync, and both fall back gracefully
 * to generated artwork when the photos haven't been downloaded yet.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the manifest can live.
 *
 * Locally it sits at public/images/photos/manifest.json. Bundlers don't
 * preserve that layout: inside the Vercel serverless function the file is
 * emitted under dist/ instead, so probing a few known locations is what keeps
 * the daily listings generator using real photographs in production.
 */
const MANIFEST_CANDIDATES = [
  path.join(__dirname, '..', 'public', 'images', 'photos', 'manifest.json'),
  path.join(__dirname, '..', '..', 'public', 'images', 'photos', 'manifest.json'),
  path.join(__dirname, '..', 'dist', 'images', 'photos', 'manifest.json'),
  path.join(__dirname, '..', '..', 'dist', 'images', 'photos', 'manifest.json'),
  path.join(process.cwd(), 'public', 'images', 'photos', 'manifest.json'),
  path.join(process.cwd(), 'dist', 'images', 'photos', 'manifest.json'),
];

/** category -> [ '/images/photos/…jpg', … ] */
const pools = new Map();
let loaded = false;

/** Loads the manifest once. Safe to call repeatedly; never throws. */
export async function loadPhotoPools() {
  if (loaded) return pools;
  loaded = true;
  for (const candidate of MANIFEST_CANDIDATES) {
    try {
      const manifest = JSON.parse(await readFile(candidate, 'utf8'));
      for (const p of manifest.photos || []) {
        if (!pools.has(p.category)) pools.set(p.category, []);
        pools.get(p.category).push(p.file);
      }
      return pools;
    } catch {
      // Try the next location.
    }
  }
  // No photos downloaded yet — callers fall back to generated artwork.
  return pools;
}

/** Photo URLs for a category, or an empty array if that category has none. */
export function poolFor(category) {
  return pools.get(category) || [];
}

/**
 * `count` photos for one listing, starting at `offset` so listings don't all
 * lead with the same photo. Wraps around, and never repeats within one pick
 * unless the pool itself is smaller than `count`.
 */
export function photosFor(category, offset = 0, count = 3) {
  const pool = poolFor(category);
  if (!pool.length) return [];
  const out = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    out.push(pool[(offset + i) % pool.length]);
  }
  return out;
}
