/**
 * Daily listing generator — 15 category generators, one per marketplace
 * category. Each generator owns its category and publishes a batch of
 * `BATCH_SIZE` listings once per calendar day (15 × 25 = 375 listings/day),
 * every listing with its own generated artwork and a few reviews.
 *
 * Scheduling: generator #i fires at minute `i * 96` of the day, so the 15
 * batches trickle through the day instead of landing in one lump. A generator
 * is "due" once its slot has passed and it hasn't run yet today, which is what
 * makes it resilient to restarts (boot, crash, deploy).
 *
 * Idempotency: each (day, category) pair is claimed once in `daily_batches`.
 * Two processes racing on the same slot produce exactly one batch.
 *
 * CLI:   npm run db:daily            run whatever is due
 *        npm run db:daily -- --all   force every generator, ignoring schedule
 * Auto:  server/index.js calls ensureDailyListings() at boot and every minute.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSvg, productSvg, glyphForTitle, hashStr } from './generate-images.mjs';
import { loadPhotoPools, photosFor, poolFor } from './photo-pool.js';

/** Size of a category's photo pool, used to pick a stable starting offset. */
const poolSize = (category) => poolFor(category).length;

/** Listings published per generator per day. */
export const BATCH_SIZE = 25;
/** One generator per category, one batch per day each. */
export const SLOTS_PER_DAY = 15;
const SLOT_MINUTES = (24 * 60) / SLOTS_PER_DAY; // 96
/** How far back a missed slot is still honoured on a later run. */
const CATCH_UP_MINUTES = 360;

const nowIso = () => new Date().toISOString();
const dayKeyOf = (d = new Date()) => d.toISOString().slice(0, 10);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 44);

/** Deterministic PRNG (mulberry32) seeded from a string. */
function rng(seedStr) {
  let a = hashStr(seedStr) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// ---------------- the 15 generators ----------------
// One entry per seeded category: slug must match categories.slug, and `pool`
// holds [noun, glyph, priceMin, priceMax].
export const GENERATORS = [
  { slug: 'jewelry', name: 'Jewelry', type: 'handmade', pool: [
    ['Birthstone Charm Bracelet', 'necklace', 34, 72], ['Pearl Drop Earrings', 'ring', 30, 66],
    ['Twisted Stacking Band', 'ring', 28, 58], ['Coin Pendant Necklace', 'necklace', 40, 88],
    ['Engraved Locket', 'necklace', 46, 96], ['Beaded Anklet', 'necklace', 22, 44],
    ['Amethyst Statement Ring', 'ring', 52, 104], ['Hand-Forged Cuff', 'ring', 60, 130],
  ] },
  { slug: 'home-decor', name: 'Home Decor', type: 'handmade', pool: [
    ['Speckled Stoneware Vase', 'vase', 38, 84], ['Reclaimed Wood Tray', 'frame', 42, 92],
    ['Hand-Poured Soy Candle', 'candle', 18, 42], ['Woven Cotton Runner', 'basket', 48, 98],
    ['Glazed Ceramic Bud Vase', 'vase', 24, 54], ['Turned Oak Bowl', 'mug', 36, 78],
    ['Macramé Wall Panel', 'basket', 64, 140], ['Carved Candle Holder', 'candle', 30, 62],
  ] },
  { slug: 'digital-products', name: 'Digital Products', type: 'digital', pool: [
    ['Printable Wall Art Set', 'print', 9, 26], ['Social Media Template Kit', 'download', 14, 34],
    ['Budget Spreadsheet Dashboard', 'book', 12, 29], ['Watercolor Pattern Pack', 'print', 11, 28],
    ['Line Icon Bundle', 'download', 10, 24], ['Digital Sticker Pack', 'download', 6, 18],
    ['Brand Style Guide Template', 'book', 18, 38], ['Wedding Planning Workbook', 'gift', 16, 32],
  ] },
  { slug: 'clothing', name: 'Clothing', type: 'handmade', pool: [
    ['Chunky Cardigan', 'shirt', 74, 148], ['Linen Drawstring Trousers', 'shirt', 56, 112],
    ['Block-Print Midi Skirt', 'shirt', 48, 96], ['Merino Crew Sweater', 'shirt', 68, 134],
    ['Cotton Gauze Wrap Top', 'shirt', 42, 86], ['Hand-Knit Fisherman Cardigan', 'shirt', 96, 190],
    ['Pleated Midi Dress', 'shirt', 82, 160], ['Quilted Lined Vest', 'shirt', 70, 135],
  ] },
  { slug: 'accessories', name: 'Accessories', type: 'handmade', pool: [
    ['Woven Crossbody Bag', 'basket', 46, 94], ['Embroidered Book Sleeve', 'book', 24, 52],
    ['Silk Hair Scarf', 'basket', 20, 48], ['Leather Key Fob', 'book', 16, 36],
    ['Beaded Summer Sandals', 'hat', 52, 108], ['Felted Wool Slouch Hat', 'hat', 44, 92],
    ['Braided Leather Belt', 'watch', 38, 84], ['Canvas Bucket Hat', 'hat', 32, 64],
  ] },
  { slug: 'art', name: 'Art', type: 'handmade', pool: [
    ['Abstract Mixed-Media Print', 'print', 32, 120], ['Charcoal Figure Study', 'frame', 44, 140],
    ['Limited Edition Giclée', 'print', 52, 160], ['Watercolour Postcard Set', 'print', 16, 44],
    ['Risograph Landscape', 'print', 38, 110], ['Botanical Ink Study', 'frame', 46, 132],
    ['Screenprinted Linen', 'frame', 58, 150], ['Hand-Pulled Monotype', 'print', 40, 118],
  ] },
  { slug: 'gifts', name: 'Gifts', type: 'handmade', pool: [
    ['Personalised Cutting Board', 'frame', 38, 82], ['Custom Constellation Print', 'print', 34, 74],
    ['Spice Blend Gift Set', 'gift', 26, 58], ['Hand-Stitched Bookmark Duo', 'book', 14, 32],
    ['Keepsake Photo Frame', 'frame', 32, 70], ['Handwritten Letterpress Card', 'gift', 8, 18],
    ['Celebration Banner', 'gift', 24, 48], ['Engraved Keepsake Box', 'gift', 44, 96],
  ] },
  { slug: 'vintage', name: 'Vintage', type: 'vintage', pool: [
    ['1970s Ceramic Table Lamp', 'lamp', 88, 210], ['Mid-Century Teak Salt Cellar', 'vase', 32, 76],
    ['Vintage Silk Pocket Square', 'basket', 18, 46], ['Retro Enamel Tin Sign', 'frame', 40, 104],
    ['1960s Cocktail Shaker', 'mug', 54, 128], ['Art Deco Mantel Clock', 'watch', 120, 320],
    ['Embroidered Table Linen', 'basket', 46, 110], ['Pressed Glass Vase', 'vase', 64, 150],
  ] },
  { slug: 'handmade', name: 'Handmade', type: 'handmade', pool: [
    ['Macramé Pendant Light', 'lamp', 58, 124], ['Hand-Carved Soapstone Owl', 'frame', 28, 64],
    ['Braided Jute Door Mat', 'basket', 30, 62], ['Hand-Knotted Rug', 'basket', 88, 220],
    ['Carved Walking Stick', 'frame', 42, 96], ['Woven Basket Tote', 'basket', 38, 78],
    ['Hand-Milled Soap Block', 'gift', 9, 20], ['Leather Tool Roll', 'book', 52, 112],
  ] },
  { slug: 'paper-goods', name: 'Paper Goods', type: 'handmade', pool: [
    ['Letterpress Card Pack', 'book', 12, 28], ['Hand-Bound Sketchbook', 'book', 34, 68],
    ['Washi Tape Sampler', 'gift', 10, 24], ['Marbled Paper A3 Sheet', 'print', 14, 32],
    ['Foil-Stamped Gift Tags', 'gift', 8, 20], ['Linen Paper Journal', 'book', 26, 52],
    ['Archival Photo Album', 'book', 48, 96], ['Block-Printed Wrapping Paper', 'print', 16, 34],
  ] },
  { slug: 'kitchen-dining', name: 'Kitchen & Dining', type: 'handmade', pool: [
    ['Speckled Dinner Plates', 'mug', 46, 96], ['Hand-Carved Serving Spoon', 'gift', 18, 40],
    ['Stoneware Mugs — Set of 4', 'mug', 64, 128], ['Linen Napkin Set', 'basket', 28, 60],
    ['Copper Measuring Cups', 'mug', 52, 104], ['Enamel Stockpot', 'mug', 88, 170],
    ['Olive Wood Board', 'frame', 44, 88], ['Hand-Rolled Espresso Cups', 'mug', 36, 72],
  ] },
  { slug: 'textiles', name: 'Textiles', type: 'handmade', pool: [
    ['Naturally Dyed Scarf', 'basket', 42, 86], ['Handwoven Throw Blanket', 'frame', 96, 210],
    ['Linen Tea Towel Set', 'basket', 24, 48], ['Wool Cushion Cover', 'basket', 38, 76],
    ['Hand-Spun Yarn Skein', 'gift', 18, 38], ['Crochet Blanket Square', 'basket', 32, 66],
    ['Botanical Dyed Fabric Length', 'frame', 54, 108], ['Knotted Macramé Strap', 'basket', 28, 58],
  ] },
  { slug: 'books', name: 'Books', type: 'handmade', pool: [
    ['Hand-Bound Poetry Collection', 'book', 26, 58], ['Risograph Zine', 'book', 12, 26],
    ['Illustrated Sketch Journal', 'book', 32, 68], ['Recipe Zine — Seasonal', 'book', 16, 32],
    ['Pressed Flower Notebook', 'book', 22, 46], ['Travel Photo Book', 'book', 42, 84],
    ['Handwritten Linen Journal', 'book', 28, 56], ['Signed First Edition', 'book', 64, 140],
  ] },
  { slug: 'kids-baby', name: 'Kids & Baby', type: 'handmade', pool: [
    ['Wooden Pull-Along Toy', 'hat', 28, 58], ['Knitted Baby Blanket', 'basket', 46, 96],
    ['Organic Cotton Bib', 'gift', 16, 34], ['Hand-Carved Wooden Rattle', 'hat', 18, 38],
    ['Felted Animal Mobile', 'gift', 34, 72], ['Embroidered Name Hoop', 'frame', 20, 42],
    ['Muslin Swaddle Set', 'basket', 38, 76], ['Wooden Puzzle Set', 'hat', 32, 66],
  ] },
  { slug: 'furniture', name: 'Furniture', type: 'handmade', pool: [
    ['Hand-Jointed Stool', 'lamp', 120, 280], ['Wall-Mounted Shelf', 'frame', 96, 220],
    ['Reclaimed Wood Bench', 'lamp', 220, 480], ['Upholstered Reading Chair', 'lamp', 380, 780],
    ['Handmade Nightstand', 'lamp', 180, 360], ['Slim Hallway Console', 'frame', 240, 460],
    ['Chest of Drawers', 'lamp', 320, 620], ['Folding Campaign Chair', 'lamp', 140, 260],
  ] },
];

// ---------------- word pools ----------------
const ADJ = [
  'Celestial', 'Hammered', 'Speckled', 'Wildflower', 'Midnight', 'Sunwashed',
  'Heirloom', 'Harvest', 'Coastal', 'Meadow', 'Ember', 'Cedarwood',
  'Juniper', 'Saffron', 'Lantern', 'Tidewater', 'Bramble', 'Copperleaf',
  'Solstice', 'Riverstone', 'Amberlight', 'Fieldstone', 'Whispering', 'Honeyed',
  'Thistledown', 'Ravenwood', 'Seaglass', 'Foxglove', 'Marigold', 'Alder',
  'Bluebell', 'Cinderglow', 'Driftwood', 'Everdusk', 'Fernshade', 'Glasswort',
  'Hollowpine', 'Ivorydale', 'Juniperoak', 'Kingfisher', 'Larkspur', 'Mosslight',
];

/** Used when an adjective+noun combination has already been published. */
const VARIANTS = [
  'Batch No. 2', 'Studio Edition', 'Small Batch', 'Atelier Series',
  'Maker’s Reserve', 'Second Pressing', 'Workshop Run', 'Archive Series',
];

const SELLER_BIO_FLAVOR = [
  'Made in small batches in our studio.',
  'Finished by hand, one at a time.',
  'Built to be used every single day.',
  'Wrapped in recycled kraft and ready to gift.',
  'Sanded, sealed and inspected before shipping.',
];

const DESC_OPEN = {
  handmade: [
    'Made by hand from carefully sourced materials — no two are exactly alike.',
    'Crafted in small batches with a focus on texture and longevity.',
    'Formed, finished and inspected by a real maker in a real workshop.',
  ],
  vintage: [
    'Sourced from estate sales and flea markets, then carefully cleaned.',
    'An authentic piece from a decade past, in lovely vintage condition.',
    'Curated, authenticated and gently restored by hand.',
  ],
  digital: [
    'Instant download — files land in your inbox seconds after checkout.',
    'A digital download you can print at home or use on your tablet.',
    'Fully editable digital files, delivered instantly.',
  ],
};

const DESC_CLOSE = [
  'Ships in 1–3 business days with tracking.',
  'Questions? Message the shop — we answer within a day.',
  'Makes a wonderful gift for anyone who loves handmade things.',
  'Eco-friendly packaging, zero plastic, always.',
  'Check the photos for true colour; what you see is what you get.',
];

const REVIEW_TEXTS = [
  ['Exactly as pictured and beautifully made. Fast shipping too!', 5],
  ['Lovely quality — you can feel the craftsmanship.', 5],
  ['Really happy with this. A little smaller than I pictured, but still great.', 4],
  ['Great value and it arrived earlier than expected.', 5],
  ['The seller was lovely to deal with and answered all my questions.', 5],
  ['Nice piece, though the colour is slightly warmer in person.', 4],
  ['Second purchase from this shop and consistent quality again.', 5],
  ['Good item — took a few days longer to ship than I hoped.', 3],
  ['Wrapped like a gift, even though I bought it for myself. Beautiful.', 5],
  ['Does exactly what it should. Happy customer.', 4],
];

/**
 * Which generators should run for this instant?
 * Generator #i's slot starts at minute i*96; it is due once that minute has
 * passed today and it has not been claimed yet. `force` ignores the schedule.
 */
export function dueGenerators(now = new Date(), force = false) {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return GENERATORS
    .map((gen, i) => ({ gen, slot: Math.round(i * SLOT_MINUTES) }))
    .filter(({ slot }) => force || (minutes >= slot && minutes - slot <= CATCH_UP_MINUTES))
    .map(({ gen }) => gen);
}

async function generateForCategory(db, gen, dayKey, sellerIds, buyerIds, ts) {
  const rand = rng(`${dayKey}#${gen.slug}`);

  // One query for every existing title, so uniqueness is resolved in memory
  // instead of a SELECT per attempt (that cost minutes across 15 categories).
  const used = new Set((await db.execute('SELECT title FROM products')).rows.map((r) => r.title));
  const rows = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    const title = pickTitle(used, rand, gen, dayKey, i);
    used.add(title);
    const entry = gen.pool.find((p) => title.includes(p[0])) || gen.pool[0];
    const glyphKey = entry[1];
    const pMin = entry[2];
    const pMax = entry[3];

    const price = Math.round((pMin + rand() * (pMax - pMin)) * 100) / 100;
    const open = pick(rand, DESC_OPEN[gen.type] || DESC_OPEN.handmade);
    const close = pick(rand, DESC_CLOSE);
    const flavor = pick(rand, SELLER_BIO_FLAVOR);
    const description = `${title}. ${open} ${flavor} ${close}`;

    const sellerId = sellerIds[Math.floor(rand() * sellerIds.length)];
    const isDigital = gen.type === 'digital';
    const inventory = isDigital ? 0 : 3 + Math.floor(rand() * 28);

    // 3 gallery images. Real photographs when the pool has been downloaded
    // (npm run db:photos), otherwise the generated artwork — the filename
    // carries the day, category slug and slot so art is never shared.
    const slug = slugify(title);
    const dayCompact = dayKey.replace(/-/g, '');
    const seed = `${dayKey}#${gen.slug}#${i}`;
    const photos = photosFor(gen.slug, hashStr(seed) % Math.max(1, poolSize(gen.slug)), 3);
    const images = JSON.stringify(photos.length === 3 ? photos : [1, 2, 3].map((v) =>
      writeSvg(
        `products/${slug}-${dayCompact}-${gen.slug}-${v}.svg`,
        productSvg(hashStr(`${seed}#${v}`) % 100000, glyphKey || glyphForTitle(title), title)
      )
    ));

    rows.push({
      title,
      stmt: {
        sql: `INSERT INTO products
                (seller_id, title, description, price, category, product_type, images, inventory,
                 is_unlimited, is_featured, is_trending, rating, review_count, location, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [sellerId, title, description, price, gen.slug, gen.type, images, inventory,
          isDigital ? 1 : 0, i === 0 ? 1 : 0, i === 3 ? 1 : 0, 0, 0, 'United States', ts, ts],
      },
      reviewSeed: `${dayKey}#${gen.slug}#${i}`,
    });
  }

  await db.batch(rows.map((r) => r.stmt), 'write');

  // Resolve the new ids in one query, then attach reviews in a single batch.
  const titles = rows.map((r) => r.title);
  const placeholders = titles.map(() => '?').join(',');
  const found = await db.execute({
    sql: `SELECT id, title FROM products WHERE title IN (${placeholders})`,
    args: titles,
  });
  const idByTitle = new Map(found.rows.map((r) => [r.title, Number(r.id)]));

  const reviewStmts = [];
  for (const row of rows) {
    const pid = idByTitle.get(row.title);
    if (!pid || !buyerIds.length) continue;
    const r2 = rng(row.reviewSeed + '#reviews');
    const reviewN = 1 + Math.floor(r2() * Math.min(3, buyerIds.length));
    const usedBuyers = new Set();
    for (let k = 0; k < reviewN; k++) {
      const reviewer = buyerIds[Math.floor(r2() * buyerIds.length)];
      if (usedBuyers.has(reviewer)) continue;
      usedBuyers.add(reviewer);
      const [text, rating] = REVIEW_TEXTS[Math.floor(r2() * REVIEW_TEXTS.length)];
      const rts = new Date(Date.parse(ts) - Math.floor(r2() * 6) * 86400000)
        .toISOString().replace('T', ' ').slice(0, 19) + 'Z';
      reviewStmts.push({
        sql: `INSERT OR IGNORE INTO product_reviews (product_id, user_id, rating, review_text, created_at, updated_at)
              VALUES (?,?,?,?,?,?)`,
        args: [pid, reviewer, rating, text, rts, rts],
      });
    }
  }
  if (reviewStmts.length) {
    await db.batch(reviewStmts, 'write');
    await db.execute({
      sql: `
        UPDATE products SET
          rating = COALESCE((SELECT ROUND(AVG(rating),1) FROM product_reviews WHERE product_id = products.id), 0),
          review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = products.id)
        WHERE id IN (SELECT id FROM products WHERE title IN (${placeholders}))`,
      args: titles,
    });
  }

  return rows.length;
}

/** Deterministic unique title: adjective + noun, widened with a variant if taken. */
function pickTitle(used, rand, gen, dayKey, i) {
  const nouns = gen.pool.map((p) => p[0]);
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = `${ADJ[Math.floor(rand() * ADJ.length)]} ${pick(rand, nouns)}`;
    if (!used.has(candidate)) return candidate;
  }
  for (const variant of VARIANTS) {
    const candidate = `${ADJ[Math.floor(rand() * ADJ.length)]} ${pick(rand, nouns)} — ${variant}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${pick(rand, nouns)} — Drop ${dayKey}-${i}`;
}

/**
 * Run every generator that is due (or all of them with `{ force: true }`).
 * @param {{ execute: Function }} db any libSQL client
 * @param {{ now?: Date, force?: boolean, log?: Function }} [opts]
 * @returns {Promise<{ day: string, created: number, ran: Array }>}
 */
export async function ensureDailyListings(db, opts = {}) {
  const now = opts.now || new Date();
  const force = Boolean(opts.force);
  const log = opts.log || (() => {});
  await loadPhotoPools();
  const dayKey = dayKeyOf(now);
  const ts = nowIso().replace('T', ' ').slice(0, 19) + 'Z';

  await db.execute(
    `CREATE TABLE IF NOT EXISTS daily_batches (
       day        TEXT NOT NULL,
       category   TEXT NOT NULL,
       listings   INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       PRIMARY KEY (day, category)
     )`
  );

  const due = dueGenerators(now, force);
  if (!due.length) return { day: dayKey, created: 0, ran: [] };

  const sellersRes = await db.execute(`SELECT id FROM users WHERE role = 'seller' ORDER BY id`);
  if (!sellersRes.rows.length) return { day: dayKey, created: 0, ran: [], reason: 'no sellers' };
  const sellerIds = sellersRes.rows.map((r) => Number(r.id));
  const buyerIds = (await db.execute(`SELECT id FROM users WHERE role != 'seller' ORDER BY id`))
    .rows.map((r) => Number(r.id));

  let total = 0;
  const ran = [];

  for (const gen of due) {
    // Claim the (day, category) slot atomically — whoever wins owns the batch.
    try {
      await db.execute({ sql: 'INSERT INTO daily_batches (day, category, listings) VALUES (?, ?, 0)', args: [dayKey, gen.slug] });
    } catch (err) {
      const msg = String(err?.message || '');
      if (/UNIQUE|constraint/i.test(msg)) { ran.push({ category: gen.slug, created: 0, skipped: true }); continue; }
      throw err;
    }

    const created = await generateForCategory(db, gen, dayKey, sellerIds, buyerIds, ts);
    await db.execute({ sql: 'UPDATE daily_batches SET listings = ? WHERE day = ? AND category = ?', args: [created, dayKey, gen.slug] });
    total += created;
    ran.push({ category: gen.slug, created });
    log(`  + ${gen.name}: ${created} listings`);
  }

  log(`Daily batch ${dayKey}: ${total} listings across ${ran.filter((r) => r.created).length} categories`);
  return { day: dayKey, created: total, ran };
}

// ---------------- CLI ----------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { makeClient } = await import('./migrate.js');
  const db = makeClient();
  const force = process.argv.includes('--all');
  try {
    const res = await ensureDailyListings(db, { force, log: (m) => console.log(m) });
    if (res.reason) console.log(`Skipped (${res.reason}) — seed the database first (npm run db:seed).`);
    else if (res.created === 0) console.log(`Nothing due for ${res.day}${force ? '' : ' (use --all to force every generator)'}.`);
    else console.log(`Added ${res.created} listings for ${res.day} across ${res.ran.filter((r) => r.created).length} categories.`);
  } catch (err) {
    console.error('Daily generation failed:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
