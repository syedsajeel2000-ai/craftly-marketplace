/**
 * Real product photos — downloader.
 *
 * The marketplace used generated abstract artwork. This pulls REAL photographs
 * of the things being sold from Openverse (openverse.org), which indexes
 * Creative Commons-licensed media, and stores them locally so the app keeps
 * working offline afterwards.
 *
 * Licence policy: only `cc0`, `pdm` (public domain) and `by` (attribution) are
 * accepted. `by-nc`, `by-nd` and similar are rejected — this marketplace is a
 * commercial-looking storefront, so non-commercial / no-derivatives licences
 * are not safe to ship. Every accepted photo is credited in
 * public/images/photos/CREDITS.md and machine-readably in manifest.json.
 *
 * Usage:
 *   npm run db:photos                # ~15 photos per category
 *   PHOTOS_PER_CATEGORY=30 npm run db:photos
 *   node scripts/fetch-photos.mjs --dry   # search only, download nothing
 */
import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const OUT_DIR = path.join(root, 'public', 'images', 'photos');

const PER_CATEGORY = Number(process.env.PHOTOS_PER_CATEGORY) || 15;
const DRY = process.argv.includes('--dry');
const ALLOWED = new Set(['cc0', 'pdm', 'by']);
const API = 'https://api.openverse.org/v1/images/';
const UA = 'craftly-marketplace-demo/1.0 (local educational marketplace demo)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * File names are derived from the source URL, not a running counter, so a
 * re-run re-finds the exact same photos, re-uses the files already on disk and
 * can never attribute a downloaded file to the wrong creator.
 */
const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).padStart(7, '0');
};

/** Product-specific search terms per category, so photos actually match the listing. */
const QUERIES = {
  jewelry: ['silver ring jewellery', 'pendant necklace', 'earrings jewellery', 'beaded bracelet',
    'handmade silver ring', 'necklace on display', 'gold earrings pair'],
  'home-decor': ['ceramic vase modern', 'soy candle jar', 'woven wall hanging', 'wooden bowl',
    'macrame wall decor', 'dried flower arrangement vase'],
  'digital-products': ['laptop desk flatlay', 'notebook and pen desk', 'planner and calendar desk',
    'graphic design workspace', 'smartphone and notebook desk', 'desk setup minimal'],
  clothing: ['knit sweater', 'linen shirt', 'wool scarf', 'handmade dress',
    'folded clothes flatlay', 'cotton tshirt'],
  accessories: ['leather handbag', 'straw hat', 'silk scarf', 'canvas tote bag',
    'woven belt buckle', 'knit beanie hat'],
  art: ['abstract art painting', 'canvas abstract art', 'gallery wall art frames',
    'modern art print', 'art studio painting'],
  gifts: ['gift box wrapping', 'handmade candle gift', 'greeting cards', 'bouquet gift',
    'wrapped present ribbon', 'gift basket wrapped'],
  vintage: ['antique camera', 'vintage table lamp', 'vintage crockery', 'antique furniture',
    'old typewriter desk', 'vintage teapot'],
  handmade: ['handmade soap', 'macrame plant hanger', 'carved wooden owl', 'handwoven basket',
    'candle wax handmade', 'ceramic mug handmade'],
  'paper-goods': ['notebook stationery', 'letterpress cards', 'washi tape', 'paper craft supplies',
    'notebook and pen', 'greeting card blank'],
  'kitchen-dining': ['ceramic dinner plate', 'wooden kitchen spoons', 'copper measuring cups',
    'linen napkin', 'stoneware mug', 'wooden cutting board'],
  textiles: ['woven wool blanket', 'dyed silk scarf', 'wool cushion cover', 'yarn skeins',
    'linen fabric folded', 'knitted throw blanket'],
  books: ['open book pages', 'stack of books', 'leather journal', 'reading books',
    'bookshelf books', 'hardcover book cover'],
  'kids-baby': ['wooden toy', 'knitted baby blanket', 'plush toy', 'wooden rattle',
    'baby clothes flatlay', 'wooden building blocks'],
  furniture: ['wooden chair', 'wooden stool', 'wall shelf', 'wooden bench',
    'wooden table furniture', 'desk and chair interior'],
};

/**
 * Openverse indexes museum collections, clip-art sites and news photos as well
 * as product photography, so some hits are photographs of the right *kind* of
 * object but of the wrong thing entirely (an archaeological vase, a handbag
 * sticker, a plate of bacon). These subjects never make sense as a shop photo.
 */
const OFF_TOPIC = new RegExp([
  'advertisement', 'advert', 'clipart', 'clip-art', 'sticker', 'transparent', 'watermark',
  'vector', 'illustration', 'drawing', 'engraving', 'sketch',
  // Museum / archaeological collections — the right noun, the wrong object.
  'museum', 'musée', 'musée', 'louvre', 'british museum', 'antiquit', 'archaeolog',
  'excavation', 'artifact', 'amphore', 'grec', 'gaulois', '\\bca\\. ?\\d', '\\bce\\b',
  '\\bad\\b', 'century',
  '\\bsold:', 'military', 'mission', 'parade', 'protest', 'politician',
  'concert', 'football', 'wedding', 'funeral', 'national theatre',
  'tacos?', 'bacon', 'wolffish', 'burrito', 'sushi', 'thanksgiving',
  'holiday', 'christmas', 'halloween', 'masquerade',
  'donut', 'pb ?& ?j', 'candy', 'super star', 'jelly',
  'logo', 'real estate', 'snowflake',
  // Cosplay / anime galleries and science photo sets — real photos, wrong shop.
  'pirates', 'one piece', 'anime', 'cosplay', 'volcan', 'fire burn', 'tent at night',
  'outdoor furniture', 'parasol', 'etrusque', 'etruscan', 'faïence', 'faience',
  'pinakothek', 'louvre', 'madonna',
].join('|'), 'i');

/**
 * Near-duplicate key.
 *
 * Openverse is full of galleries that shoot one subject many times ("Straw Hat
 * Pirates: Usopp", "…: Nami", "Colorful Autumn leaves and laptop on a black
 * background. Top view…" ×6). Those titles differ only after their first few
 * words, so keying on the opening words collapses them into one photo and
 * frees the slot for something genuinely different.
 */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'on', 'in', 'and', 'at', 'to', 'for', 'with', 'by', 'from', 'de', 'la', 'le']);
const titleKey = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  .slice(0, 3)
  .join(' ');


const LICENSE_URL = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  pdm: 'https://creativecommons.org/publicdomain/mark/1.0/',
  by: (v) => `https://creativecommons.org/licenses/by/${v || '4.0'}/`,
};

const licenseUrlFor = (r) =>
  r.license === 'by' ? LICENSE_URL.by(r.license_version) : LICENSE_URL[r.license] || '';

async function apiSearch(query, attempt = 0) {
  const url = `${API}?q=${encodeURIComponent(query)}&license=cc0,pdm,by&page_size=20&mature=false`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 3) { await sleep(1500 * (attempt + 1)); return apiSearch(query, attempt + 1); }
      return [];
    }
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.results) ? json.results : [];
  } catch {
    if (attempt < 2) { await sleep(1200); return apiSearch(query, attempt + 1); }
    return [];
  }
}

/** Only usable, licensed, on-topic, big-enough photos. */
function usable(r) {
  if (!r?.url || !r.thumbnail) return false;
  if (!ALLOWED.has(r.license)) return false;
  if ((r.width || 0) < 400 || (r.height || 0) < 300) return false;
  if (!/^https?:\/\//.test(r.url)) return false;
  // A generic title ("A gift", "Jewelry") tells us nothing but isn't wrong;
  // an explicitly off-topic one rules the photo out.
  if (OFF_TOPIC.test(r.title || '')) return false;
  return true;
}

async function download(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4000) return null; // skip icons/broken thumbnails
    return { buf, type };
  } catch {
    return null;
  }
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const seenSource = new Set();
  const seenTitle = new Set();
  const photos = [];
  const perCat = {};

  for (const [category, queries] of Object.entries(QUERIES)) {
    const saved = [];
    const candidates = [];

    for (const q of queries) {
      if (saved.length >= PER_CATEGORY) break;
      const results = await apiSearch(q);
      for (const r of results) {
        if (!usable(r)) continue;
        if (seenSource.has(r.url)) continue;
        // Openverse returns many near-identical shots of the same object; one
        // per distinct title keeps a category from looking like one photo.
        const key = `${category}:${titleKey(r.title)}`;
        if (titleKey(r.title) && seenTitle.has(key)) continue;
        seenTitle.add(key);
        seenSource.add(r.url);
        candidates.push(r);
      }
      await sleep(200); // be polite to the API
    }

    for (const r of candidates) {
      if (saved.length >= PER_CATEGORY) break;
      const file = `${category}-${hashStr(r.url)}.jpg`;
      const abs = path.join(OUT_DIR, file);
      const have = await exists(abs);

      if (!have && !DRY) {
        const got = await download(r.thumbnail);
        if (!got) continue;
        await writeFile(abs, got.buf);
        await sleep(120);
      } else if (!have) {
        continue; // dry run: nothing on disk to describe
      }

      saved.push({
        id: r.id,
        category,
        file: `/images/photos/${file}`,
        title: (r.title || 'Untitled').slice(0, 120),
        creator: r.creator || 'Unknown',
        creator_url: r.creator_url || r.foreign_landing_url || '',
        license: r.license.toUpperCase() + (r.license_version ? ' ' + r.license_version : ''),
        license_url: licenseUrlFor(r),
        source: r.source || '',
        source_url: r.foreign_landing_url || r.url,
      });
    }

    perCat[category] = saved.length;
    photos.push(...saved);
    console.log(`  ${saved.length >= PER_CATEGORY ? '+' : '!'} ${category.padEnd(17)} ${saved.length} photo${saved.length === 1 ? '' : 's'}`);
  }

  if (DRY) {
    console.log(`\n(dry run) would fetch ${photos.length} photos`);
    return;
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'Openverse — https://openverse.org (Creative Commons)',
    licenses: 'CC0, Public Domain Mark, CC BY (attribution). NC/ND excluded.',
    photos_per_category_target: PER_CATEGORY,
    counts: perCat,
    photos,
  };
  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const byLicense = photos.reduce((acc, p) => ({ ...acc, [p.license]: (acc[p.license] || 0) + 1 }), {});
  const md = [
    '# Photo credits',
    '',
    'These photographs come from [Openverse](https://openverse.org), which indexes Creative',
    'Commons-licensed media. Each one is used under the licence shown below; CC BY photos',
    'require attribution, which this file provides.',
    '',
    `Downloaded ${new Date().toISOString().slice(0, 10)} · ${photos.length} photos · licences: ${Object.entries(byLicense).map(([k, v]) => `${k} (${v})`).join(', ')}`,
    '',
    'Only CC0, Public Domain Mark and CC BY images are included — non-commercial (NC) and',
    'no-derivatives (ND) licences are deliberately excluded.',
    '',
    '| File | Title | Creator | Licence | Source |',
    '| ---- | ----- | ------- | ------- | ------ |',
    ...photos.map((p) =>
      `| \`${p.file}\` | ${p.title} | ${p.creator_url ? `[${p.creator}](${p.creator_url})` : p.creator} | [${p.license}](${p.license_url}) | ${p.source_url ? `[${p.source || 'original'}](${p.source_url})` : p.source || '—'} |`
    ),
    '',
  ].join('\n');
  await writeFile(path.join(OUT_DIR, 'CREDITS.md'), md);

  console.log(`\n  ${photos.length} photos saved to public/images/photos/`);
  console.log('  credits: public/images/photos/CREDITS.md + manifest.json');
}

main().catch((err) => {
  console.error('Photo fetch failed:', err.message);
  process.exitCode = 1;
});
