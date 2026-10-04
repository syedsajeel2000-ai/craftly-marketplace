/**
 * Bulk catalog seeder.
 *
 * The base seed (scripts/seed.js) ships the hand-written demo shop. This adds
 * the *rest of the marketplace*: a large pre-made catalog plus a much bigger
 * pool of sellers and buyers, so the marketplace feels like a real, busy
 * marketplace instead of a 60-listing showcase.
 *
 *   + 2,000 listings across all 15 categories (default, override BULK_LISTINGS)
 *   + 3 unique generated images per listing (6,000 SVG files)
 *   + reviews on most listings, with correct rating aggregates
 *   + 200 extra sellers and 140 extra buyers (BULK_SELLERS / BULK_BUYERS)
 *   + listings spread across every seller, so each shop has a storefront
 *
 * Usage:  npm run db:bulk            add the default amounts
 *         npm run db:bulk -- 500     add 500 listings instead
 *
 * Idempotent: records what it created in `seed_batches`, so re-running skips
 * work that is already there instead of piling up duplicates.
 */
import bcrypt from 'bcryptjs';
import { makeClient } from './migrate.js';
import { writeSvg, productSvg, avatarSvg, hashStr } from './generate-images.mjs';
import { loadPhotoPools, photosFor, poolFor } from './photo-pool.js';
import { GENERATORS } from './daily-listings.js';

const LISTINGS = Number(process.env.BULK_LISTINGS) || Number(process.argv[2]) || 2000;
const SELLERS = Number(process.env.BULK_SELLERS) || 200;
const BUYERS = Number(process.env.BULK_BUYERS) || 140;
const PASSWORD = process.env.BULK_PASSWORD || 'Password123!';
const IMAGES_PER_LISTING = 3;
const CHUNK = 200;

const db = makeClient();
/** Size of a category's photo pool, used to pick a stable starting offset. */
const poolSize = (category) => poolFor(category).length;
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

const ADJ = [
  'Alpine', 'Amberlight', 'Alder', 'Ashen', 'Aster', 'Aurora', 'Bay', 'Bluebell',
  'Bramble', 'Cedarwood', 'Cinder', 'Clay', 'Copperleaf', 'Coral', 'Cottage', 'Dawn',
  'Driftwood', 'Dune', 'Ember', 'Fable', 'Fernshade', 'Fieldstone', 'Flint', 'Foxglove',
  'Frost', 'Garden', 'Glasswort', 'Glow', 'Golden', 'Harbor', 'Harvest', 'Heather',
  'Hollowpine', 'Honeyed', 'Indigo', 'Ivory', 'Juniper', 'Kingfisher', 'Larkspur', 'Lichen',
  'Marigold', 'Meadow', 'Mill', 'Moss', 'Mosslight', 'Nectar', 'Northwind', 'Oakum',
  'Orchard', 'Peach', 'Pebble', 'Pine', 'Poppy', 'Quarry', 'Quill', 'Ravenwood',
  'Rill', 'Rosehip', 'Rowan', 'Rustic', 'Sage', 'Saltmarsh', 'Sandbar', 'Searidge',
  'Seedling', 'Shell', 'Slate', 'Sorrel', 'Spruce', 'Starling', 'Stonecrop', 'Sumac',
  'Sunwashed', 'Tansy', 'Tidewater', 'Thistle', 'Thistledown', 'Tulip', 'Umber',
  'Valley', 'Vesper', 'Vine', 'Wattle', 'Whispering', 'Wildflower', 'Willow', 'Wren',
  'Yarrow', 'Zephyr',
];

const VARIANTS = [
  'Studio Edition', 'Small Batch', 'Maker’s Reserve', 'Workshop Run', 'Second Edition',
  'Atelier Series', 'Archive Series', 'Batch No. 3', 'Limited Pressing',
];

const DESCRIPTIONS = {
  handmade: [
    'Made by hand from carefully sourced materials — no two pieces are exactly alike.',
    'Built in small batches, finished one at a time and inspected before it ships.',
    'Slow-made and designed to be repaired, reused and handed on.',
  ],
  vintage: [
    'Found on a weekend hunt through estate sales, then cleaned and cared for.',
    'A genuine piece from another decade, with the patina to prove it.',
    'Curated, checked over and restored only where it needed it.',
  ],
  digital: [
    'Instant download — the files land in your inbox seconds after checkout.',
    'Fully editable files you can print at home or open on any device.',
    'Includes a quick-start guide so you can customise it in minutes.',
  ],
};

const CLOSERS = [
  'Ships in 1–3 business days with tracking.',
  'Questions? Message the shop — we answer within a day.',
  'Eco-friendly packaging, zero plastic, always.',
  'Makes a wonderful gift for anyone who loves handmade things.',
  'Gift wrapping available at checkout.',
];

const REVIEWS = [
  ['Exactly as pictured and beautifully made. Fast shipping too!', 5],
  ['Lovely quality — you can feel the craftsmanship.', 5],
  ['Really happy with this. A little smaller than I pictured, but still great.', 4],
  ['Great value and it arrived earlier than expected.', 5],
  ['The seller was lovely to deal with and answered all my questions.', 5],
  ['Nice piece, though the colour is slightly warmer in person.', 4],
  ['Second purchase from this shop and consistent quality again.', 5],
  ['Good item — took a few days longer to ship than I hoped.', 3],
  ['Arrived wrapped like a gift. Beautiful.', 5],
  ['Solid piece for the money. Happy customer.', 4],
  ['Better than the mass-produced version I returned last month.', 5],
  ['Simple, well made and reasonably priced.', 4],
];

const FIRST = ['Ada', 'Bo', 'Cleo', 'Dara', 'Elin', 'Finn', 'Greta', 'Hugo', 'Iris', 'Jonas', 'Kira', 'Levi', 'Mira', 'Nils', 'Oona', 'Pia', 'Quill', 'Rhea', 'Soren', 'Tilda', 'Ulla', 'Vera', 'Wren', 'Xan', 'Yuki', 'Zola', 'Alba', 'Bram', 'Cove', 'Dune', 'Emil', 'Fen', 'Gale', 'Hollis', 'Ines', 'Jory'];
const LAST = ['Ashford', 'Bellamy', 'Castellan', 'Dahl', 'Ellery', 'Farrow', 'Grieve', 'Halloway', 'Iverson', 'Jarvis', 'Kestrel', 'Larkin', 'Merrow', 'Norwood', 'Ostrander', 'Prewitt', 'Quill', 'Rushton', 'Sable', 'Thatcher', 'Underhill', 'Vance', 'Whitlock', 'Yarrow', 'Zephyr'];
const PLACES = ['Portland, OR', 'Asheville, NC', 'Brooklyn, NY', 'Austin, TX', 'Seattle, WA', 'Boulder, CO', 'Savannah, GA', 'Santa Fe, NM', 'Burlington, VT', 'Ithaca, NY', 'Flagstaff, AZ', 'Missoula, MT', 'Rhode Island', 'Olympia, WA', 'Madison, WI', 'Ann Arbor, MI', 'Durham, NC', 'Providence, RI', 'Bozeman, MT', 'Louisville, KY'];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 44);
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

function rng(seedStr) {
  let a = hashStr(seedStr) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function alreadySeeded(label) {
  await db.execute(`CREATE TABLE IF NOT EXISTS seed_batches (
    label      TEXT PRIMARY KEY,
    listings   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const row = await db.execute({ sql: 'SELECT label FROM seed_batches WHERE label = ?', args: [label] });
  return row.rows.length > 0;
}

async function addPeople() {
  const counts = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'seller') AS sellers,
       (SELECT COUNT(*) FROM users WHERE role != 'seller') AS buyers`
  );
  const sellersNow = Number(counts.rows[0].sellers);
  const buyersNow = Number(counts.rows[0].buyers);
  const wantSellers = Math.max(0, SELLERS);
  const wantBuyers = Math.max(0, BUYERS);
  if (sellersNow >= wantSellers && buyersNow >= wantBuyers) {
    console.log(`  = sellers ${sellersNow}, buyers ${buyersNow} (already enough)`);
    return;
  }

  // One hash reused for every generated account — these are public demo
  // accounts with a published password, and hashing 160 times is needless CPU.
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = ts();
  const rand = rng('bulk-people-v1');
  const stmts = [];

  let n = sellersNow;
  for (let i = 0; i < Math.max(0, wantSellers - sellersNow); i++, n++) {
    const name = `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
    const username = `${name.split(' ')[0].toLowerCase()}${name.split(' ')[1].toLowerCase().slice(0, 4)}${n}`;
    const avatar = writeSvg(`avatars/${username}.svg`, avatarSvg(n, name.split(' ').map((p) => p[0]).join('').slice(0, 2)));
    stmts.push({
      sql: `INSERT OR IGNORE INTO users (name, username, email, password_hash, role, avatar, bio, created_at)
            VALUES (?,?,?,?,'seller',?,?,?)`,
      args: [name, username, `${username}@shop.craftly.demo`, hash, avatar,
        'Independent maker shipping small batches from a home studio.', now],
    });
  }

  let b = buyersNow;
  for (let i = 0; i < Math.max(0, wantBuyers - buyersNow); i++, b++) {
    const name = `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
    const username = `${name.split(' ')[0].toLowerCase()}${name.split(' ')[1].toLowerCase().slice(0, 4)}${b}`;
    const avatar = writeSvg(`avatars/${username}.svg`, avatarSvg(b + 500, name.split(' ').map((p) => p[0]).join('').slice(0, 2)));
    stmts.push({
      sql: `INSERT OR IGNORE INTO users (name, username, email, password_hash, role, avatar, bio, created_at)
            VALUES (?,?,?,?,'buyer',?,?,?)`,
      args: [name, username, `${username}@buyer.craftly.demo`, hash, avatar, null, now],
    });
  }

  for (let i = 0; i < stmts.length; i += CHUNK) {
    await db.batch(stmts.slice(i, i + CHUNK), 'write');
  }
  console.log(`  + ${Math.max(0, wantSellers - sellersNow)} sellers, ${Math.max(0, wantBuyers - buyersNow)} buyers (password: ${PASSWORD})`);
}

/**
 * Give every seller a populated storefront.
 *
 * Listings were handed out at random, so with 200 shops the tail sellers can
 * end up with nothing to show on /shop/:username. This moves listings from the
 * busiest shops to the emptiest ones until the spread is even — every seller
 * ends with at least a few listings, and nobody loses their whole catalog.
 */
async function spreadListings() {
  const sellers = await db.execute(`SELECT id FROM users WHERE role = 'seller' ORDER BY id`);
  const ids = sellers.rows.map((r) => Number(r.id));
  if (ids.length < 2) return;

  const counts = new Map(ids.map((id) => [id, 0]));
  for (const r of (await db.execute('SELECT seller_id, COUNT(*) AS c FROM products GROUP BY seller_id')).rows) {
    if (counts.has(Number(r.seller_id))) counts.set(Number(r.seller_id), Number(r.c));
  }

  const total = Number((await db.execute('SELECT COUNT(*) AS c FROM products')).rows[0].c);
  const target = Math.max(1, Math.floor(total / ids.length));
  const rand = rng('spread-v1');
  const moves = [];

  // Donors first (busiest shops give up listings before the rest are touched).
  const order = [...ids].sort((a, b) => counts.get(b) - counts.get(a));

  for (const id of order) {
    const donorRows = await db.execute(
      `SELECT id FROM products WHERE seller_id = ? ORDER BY RANDOM() LIMIT ?`,
      [id, Math.max(0, counts.get(id) - target)]);
    if (!donorRows.rows.length) continue;

    let k = 0;
    for (const row of donorRows.rows) {
      // Find a shop that is still short. Retry a bounded number of times so a
      // single unlucky draw can't strand the remaining listings.
      let pick = null;
      for (let attempt = 0; attempt < 40 && !pick; attempt++) {
        const candidate = ids[Math.floor(rand() * ids.length)];
        if (counts.get(candidate) < target) pick = candidate;
      }
      if (!pick) continue;
      moves.push({ sql: 'UPDATE products SET seller_id = ? WHERE id = ?', args: [pick, Number(row.id)] });
      counts.set(id, counts.get(id) - 1);
      counts.set(pick, counts.get(pick) + 1);
      k++;
    }
    if (k) process.stdout.write(`\r  spreading… ${moves.length} listings moved`);
  }
  process.stdout.write(`\r  spreading… ${moves.length} listings moved\n`);

  for (let i = 0; i < moves.length; i += CHUNK) await db.batch(moves.slice(i, i + CHUNK), 'write');
  if (moves.length) console.log(`  ~ ${moves.length} listings spread across ${ids.length} shops (target ${target} each)`);
}

async function addCatalog() {
  await loadPhotoPools();
  const sellers = await db.execute(`SELECT id FROM users WHERE role = 'seller' ORDER BY id`);
  const sellerIds = sellers.rows.map((r) => Number(r.id));
  if (!sellerIds.length) throw new Error('no sellers — run npm run db:seed first');

  const buyers = await db.execute(`SELECT id FROM users WHERE role != 'seller' ORDER BY id`);
  const buyerIds = buyers.rows.map((r) => Number(r.id));

  const used = new Set((await db.execute('SELECT title FROM products')).rows.map((r) => r.title));
  const nowMs = Date.now();
  const t0 = Date.now();

  const productStmts = [];
  const pending = []; // { title } — resolved to ids after insert

  for (let i = 0; i < LISTINGS; i++) {
    const gen = GENERATORS[i % GENERATORS.length];
    const rand = rng(`bulk#${i}#${gen.slug}`);
    const nouns = gen.pool.map((p) => p[0]);

    // Unique title: adjective + noun, widened with a variant when taken.
    let title = '';
    for (let a = 0; a < 40 && !title; a++) {
      const candidate = `${pick(rand, ADJ)} ${pick(rand, nouns)}`;
      if (!used.has(candidate)) title = candidate;
    }
    if (!title) {
      for (const variant of VARIANTS) {
        const candidate = `${pick(rand, ADJ)} ${pick(rand, nouns)} — ${variant}`;
        if (!used.has(candidate)) { title = candidate; break; }
      }
    }
    if (!title) title = `${pick(rand, nouns)} — Batch ${i}`;
    used.add(title);

    const entry = gen.pool.find((p) => title.includes(p[0])) || gen.pool[0];
    const price = Math.round((entry[2] + rand() * (entry[3] - entry[2])) * 100) / 100;
    const isDigital = gen.type === 'digital';
    const description = `${title}. ${pick(rand, DESCRIPTIONS[gen.type] || DESCRIPTIONS.handmade)} ${pick(rand, CLOSERS)}`;
    const sellerId = sellerIds[Math.floor(rand() * sellerIds.length)];
    const inventory = isDigital ? 0 : 2 + Math.floor(rand() * 40);
    const createdAt = new Date(nowMs - Math.floor(rand() * 45) * 86400000)
      .toISOString().replace('T', ' ').slice(0, 19) + 'Z';

    // 3 images per listing. Real photographs from the downloaded pool when
    // available (rotated by a hash so listings don't all open on the same
    // photo), otherwise generated artwork whose filename carries the listing
    // index so it is never shared or overwritten by another batch.
    const slug = slugify(title);
    const photos = photosFor(gen.slug, hashStr(`bulk#${i}`) % Math.max(1, poolSize(gen.slug)), IMAGES_PER_LISTING);
    const images = JSON.stringify(photos.length === IMAGES_PER_LISTING
      ? photos
      : Array.from({ length: IMAGES_PER_LISTING }, (_, v) =>
        writeSvg(`products/${slug}-b${i}-${v + 1}.svg`,
          productSvg(hashStr(`bulk#${i}#${v}`) % 100000, entry[1], title))));

    productStmts.push({
      sql: `INSERT INTO products
              (seller_id, title, description, price, category, product_type, images, inventory,
               is_unlimited, is_featured, is_trending, rating, review_count, location, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [sellerId, title, description, price, gen.slug, gen.type, images, inventory,
        isDigital ? 1 : 0, 0, 0, 0, 0, pick(rand, PLACES), createdAt, createdAt],
    });
    pending.push({ i, randSeed: `bulk#${i}`, gen, title });

    if (productStmts.length >= CHUNK) {
      await db.batch(productStmts.splice(0), 'write');
      process.stdout.write(`\r  generating… ${pending.length}/${LISTINGS} listings`);
    }
  }
  if (productStmts.length) await db.batch(productStmts, 'write');
  process.stdout.write(`\r  generating… ${pending.length}/${LISTINGS} listings\n`);

  // Reviews: most listings get 1–4, drawn from the buyer pool.
  const byTitle = new Map();
  const recent = await db.execute(`SELECT id, title FROM products ORDER BY id DESC LIMIT ${LISTINGS}`);
  for (const r of recent.rows) byTitle.set(r.title, Number(r.id));

  const reviewStmts = [];
  let reviewTotal = 0;
  for (const p of pending) {
    const pid = byTitle.get(p.title);
    if (!pid || !buyerIds.length) continue;
    const rand = rng(p.randSeed + '#reviews');
    const n = rand() < 0.12 ? 0 : 1 + Math.floor(rand() * 4);
    const usedBuyers = new Set();
    for (let k = 0; k < n; k++) {
      const uid = buyerIds[Math.floor(rand() * buyerIds.length)];
      if (usedBuyers.has(uid)) continue;
      usedBuyers.add(uid);
      const [text, rating] = REVIEWS[Math.floor(rand() * REVIEWS.length)];
      const rts = new Date(nowMs - Math.floor(rand() * 40) * 86400000)
        .toISOString().replace('T', ' ').slice(0, 19) + 'Z';
      reviewStmts.push({
        sql: `INSERT OR IGNORE INTO product_reviews (product_id, user_id, rating, review_text, created_at, updated_at)
              VALUES (?,?,?,?,?,?)`,
        args: [pid, uid, rating, text, rts, rts],
      });
      reviewTotal++;
    }
    if (reviewStmts.length >= CHUNK) await db.batch(reviewStmts.splice(0), 'write');
  }
  if (reviewStmts.length) await db.batch(reviewStmts, 'write');

  // Rating aggregates for everything this run touched.
  await db.execute(`
    UPDATE products SET
      rating = COALESCE((SELECT ROUND(AVG(rating),1) FROM product_reviews WHERE product_id = products.id), 0),
      review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = products.id)
    WHERE rating = 0 AND review_count = 0
      AND EXISTS (SELECT 1 FROM product_reviews WHERE product_id = products.id)`);

  await db.execute({
    sql: 'INSERT OR REPLACE INTO seed_batches (label, listings, created_at) VALUES (?,?,?)',
    args: [`bulk-catalog-${LISTINGS}`, LISTINGS, ts()],
  });

  console.log(`  + ${LISTINGS} listings (${LISTINGS * IMAGES_PER_LISTING} images) + ${reviewTotal} reviews in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

async function main() {
  const label = `bulk-catalog-${LISTINGS}`;
  if (await alreadySeeded(label)) {
    const total = await db.execute('SELECT COUNT(*) AS c FROM products');
    console.log(`Bulk catalog "${label}" already seeded — ${total.rows[0].c} listings present.`);
    // Still top the shop count up: the people steps are idempotent and cheap.
    await addPeople();
    await spreadListings();
    console.log('Use a different count (e.g. npm run db:bulk -- 3000) to add more listings.');
    db.close();
    return;
  }
  console.log('Bulk seeding marketplace catalog…');
  await addPeople();
  await spreadListings();
  await addCatalog();
  await spreadListings();
  console.log('Bulk seed complete.');
  db.close();
}

main().catch((err) => {
  console.error('Bulk seed failed:', err.message);
  process.exitCode = 1;
  db.close();
});
