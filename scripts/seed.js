/**
 * Seeds the Turso / libSQL database with:
 *  - categories
 *  - demo users (buyer + sellers)
 *  - ~60 realistic products with generated license-free SVG artwork
 *  - reviews, wishlist entries, a sample order
 *
 * Usage: npm run db:seed   (idempotent — safe to re-run)
 */
import bcrypt from 'bcryptjs';
import { makeClient } from './migrate.js';
import { writeSvg, productSvg, categorySvg, avatarSvg } from './generate-images.mjs';
import { loadPhotoPools, photosFor, poolFor } from './photo-pool.js';

const db = makeClient();

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

async function count(sql, args = []) {
  const r = await db.execute({ sql, args });
  return Number(r.rows[0].c);
}

async function run(sql, args = []) {
  return db.execute({ sql, args });
}

async function lastId() {
  const r = await db.execute('SELECT last_insert_rowid() AS id');
  return Number(r.rows[0].id);
}

// ---------------- Categories ----------------
const categories = [
  ['Handmade', 'handmade', 'One-of-a-kind pieces made by real artisans.', 'gift'],
  ['Jewelry', 'jewelry', 'Rings, necklaces, earrings and handmade adornments.', 'ring'],
  ['Home Decor', 'home-decor', 'Warm, characterful pieces for every room.', 'lamp'],
  ['Digital Products', 'digital-products', 'Instant downloads: prints, planners, fonts.', 'download'],
  ['Vintage', 'vintage', 'Curated treasures from decades past.', 'camera'],
  ['Art', 'art', 'Original art and limited-edition prints.', 'frame'],
  ['Clothing', 'clothing', 'Small-batch apparel and slow fashion.', 'shirt'],
  ['Gifts', 'gifts', 'Thoughtful gifts for every occasion.', 'gift'],
  ['Accessories', 'accessories', 'Bags, scarves, hats and finishing touches.', 'basket'],
  ['Paper Goods', 'paper-goods', 'Letterpress cards, journals and paper craft.', 'book'],
  ['Kitchen & Dining', 'kitchen-dining', 'Tableware, linens and small-batch provisions.', 'mug'],
  ['Textiles', 'textiles', 'Woven, knitted and naturally dyed fabrics.', 'basket'],
  ['Books', 'books', 'Zines, poetry and hand-bound volumes.', 'book'],
  ['Kids & Baby', 'kids-baby', 'Playthings and keepsakes for little ones.', 'hat'],
  ['Furniture', 'furniture', 'Small-batch pieces built to last a lifetime.', 'lamp'],
];

// ---------------- Users ----------------
const users = [
  {
    name: 'Ava Bennett', username: 'avabennett', email: 'ava@example.com',
    role: 'buyer', password: 'Password123!', bio: 'Collector of handmade treasures.',
  },
  {
    name: 'Maya Rivera', username: 'mayamakes', email: 'maya@example.com',
    role: 'seller', password: 'Password123!', location: 'Portland, OR',
    bio: 'Jeweler working in recycled gold and raw stone. Every piece is made at my kitchen bench.',
  },
  {
    name: 'Oliver Shaw', username: 'olivershop', email: 'oliver@example.com',
    role: 'seller', password: 'Password123!', location: 'Asheville, NC',
    bio: 'Woodworker & ceramicist. Warm textures for slow homes.',
  },
  {
    name: 'Sienna Clarke', username: 'siennavintage', email: 'sienna@example.com',
    role: 'seller', password: 'Password123!', location: 'Brooklyn, NY',
    bio: 'Curated vintage finds from estate sales across the Northeast.',
  },
  {
    name: 'Noah Kim', username: 'noahdigital', email: 'noah@example.com',
    role: 'seller', password: 'Password123!', location: 'Austin, TX',
    bio: 'Designer building printable art, planners and font kits.',
  },
  {
    name: 'Lena Ford', username: 'lenaford', email: 'lena@example.com',
    role: 'seller', password: 'Password123!', location: 'Seattle, WA',
    bio: 'Textile artist — naturally dyed scarves and woven wall hangings.',
  },
  {
    name: 'Ruby Alvarez', username: 'rubyalvarez', email: 'ruby@example.com',
    role: 'buyer', password: 'Password123!', bio: 'Interior stylist with a soft spot for ceramics.',
  },
  {
    name: 'Theo Marsh', username: 'theomarsh', email: 'theo@example.com',
    role: 'buyer', password: 'Password123!', bio: 'Woodworker by weekend, vintage hunter always.',
  },
  {
    name: 'Priya Nair', username: 'priyanair', email: 'priya@example.com',
    role: 'buyer', password: 'Password123!', bio: 'Gifting enthusiast — I buy presents year-round.',
  },
  {
    name: 'Jack O’Brien', username: 'jackobrien', email: 'jack@example.com',
    role: 'buyer', password: 'Password123!', bio: 'Collector of prints, pins and odd little objects.',
  },
];

// ---------------- Products ----------------
// [title, description, price, category, type, glyph, inventory, featured, trending, sellerIdx]
const products = [
  ['Hand-Forged Moonstone Ring', 'A luminous moonstone set in hand-forged recycled sterling silver. Each ring is hammered, filed and polished at my bench, so no two are exactly alike. Comes gift-boxed with a polishing cloth.', 68, 'Jewelry', 'handmade', 'ring', 14, 1, 1, 1],
  ['Dainty Gold Birthstone Necklace', 'An 14k gold-filled chain holding a faceted birthstone charm. Layer it solo or stack three. Choose your stone at checkout — made to order in 2–3 days.', 54, 'Jewelry', 'handmade', 'necklace', 22, 1, 0, 1],
  ['Raw Emerald Stud Earrings', 'Untouched emerald studs in simple gold wire wraps. Lightweight, luminous and quietly luxurious for everyday wear.', 42, 'Jewelry', 'handmade', 'ring', 9, 0, 1, 1],
  ['Braided Leather Cuff Bracelet', 'Full-grain leather braided by hand and finished with a solid brass clasp. Ages beautifully with wear.', 38, 'Jewelry', 'handmade', 'necklace', 18, 0, 0, 1],
  ['Hammered Copper Bangle Set', 'Three stacking bangles in solid copper, hammered for texture and sealed to keep their glow.', 31, 'Jewelry', 'handmade', 'ring', 25, 0, 0, 1],
  ['Vintage Pearl Drop Necklace', 'Circa 1960s cream pearls with a vermeil clasp. Lightly loved, professionally cleaned, ready to wear.', 96, 'Jewelry', 'vintage', 'necklace', 3, 1, 1, 2],
  ['Mid-Century Brass Candelabra', 'A striking five-arm brass candelabra from the 1950s. Beautiful patina, structurally perfect.', 128, 'Home Decor', 'vintage', 'lamp', 2, 1, 0, 2],
  ['Hand-Thrown Stoneware Mug', 'Wheel-thrown speckled stoneware with a satin glaze. Holds 12oz and is dishwasher safe. Made in small batches.', 34, 'Home Decor', 'handmade', 'mug', 30, 1, 1, 1],
  ['Ceramic Bud Vase Trio', 'Three tiny hand-pinched vases in complementary glazes. Perfect for single stems on a windowsill.', 46, 'Home Decor', 'handmade', 'vase', 16, 0, 1, 1],
  ['Woven Jute Wall Hanging', 'A textured wall hanging woven on a driftwood loom with natural jute and undyed cotton. 24" wide.', 89, 'Home Decor', 'handmade', 'basket', 7, 1, 0, 5],
  ['Walnut Serving Board', 'Hand-planed black walnut with a food-safe oil finish. Deep juice groove, rounded edges. Every grain pattern is unique.', 72, 'Home Decor', 'handmade', 'frame', 11, 0, 0, 2],
  ['Soy Wax Candle — Cedar & Sage', 'Hand-poured soy wax with a cotton wick and essential-oil blend. 45-hour burn in a reusable amber jar.', 28, 'Home Decor', 'handmade', 'candle', 40, 0, 1, 2],
  ['Vintage Mushroom Table Lamp', 'An iconic 1970s dome lamp in cream enamel. Rewired with a new cloth cord and plug.', 165, 'Home Decor', 'vintage', 'lamp', 1, 1, 1, 2],
  ['Boho Macramé Plant Hanger', 'Knotted from 100% cotton cord with wooden beads. Fits a 6" pot and includes a brass hook.', 32, 'Home Decor', 'handmade', 'basket', 20, 0, 0, 5],
  ['Botanical Line Art Set (12 Prints)', 'Twelve printable botanical line drawings at 300 DPI A4. Instant download — print at home or your local shop. Personal use license included.', 18, 'Digital Products', 'digital', 'print', 999, 1, 1, 3],
  ['Minimalist Poster Pack Vol. 3', 'Thirty abstract posters in muted tones, sized for 4x6 through A1. Files delivered as PNG + PDF.', 24, 'Digital Products', 'digital', 'frame', 999, 0, 1, 3],
  ['Small Business Planner (PDF)', 'A 60-page undated planner: cash flow, goals, inventory and social calendars. Hyperlinked for tablets.', 16, 'Digital Products', 'digital', 'book', 999, 1, 0, 3],
  ['Watercolor Brush Pack for Procreate', '25 pressure-sensitive watercolor brushes tested on iPad Pro. Includes grain textures and a mixing guide.', 22, 'Digital Products', 'digital', 'download', 999, 0, 1, 3],
  ['Wedding Invitation Template Suite', 'Editable Canva invitation suite: invite, RSVP, details and menu. Change every word and colour in minutes.', 29, 'Digital Products', 'digital', 'gift', 999, 0, 0, 3],
  ['Rustic Handmade Recipe Box', 'Solid oak recipe box with hand-burned lettering and 50 printed divider cards. A wedding favourite.', 58, 'Gifts', 'handmade', 'book', 12, 1, 0, 2],
  ['Personalized Family Portrait', 'A custom illustrated portrait from your photo, drawn in warm ink-and-watercolour style. Delivered as a high-res file.', 65, 'Gifts', 'handmade', 'frame', 8, 1, 1, 3],
  ['Custom Pet Name Necklace', 'Your pet\'s name in elegant script, laser-cut in brass or stainless. Choose your finish at checkout.', 49, 'Gifts', 'handmade', 'necklace', 17, 0, 1, 1],
  ['Hand-Poured Gift Trio', 'Three soy candles nested in a kraft gift box with a hand-written note. Ready to gift.', 52, 'Gifts', 'handmade', 'candle', 15, 0, 0, 2],
  ['Vintage Cocktail Recipe Tin', 'A 1960s lithographed recipe tin with 24 classic cocktail cards. Gentle wear consistent with age.', 44, 'Gifts', 'vintage', 'mug', 4, 0, 0, 2],
  ['Chunky Knit Wool Scarf', 'Hand-knit from 100% merino in a soft oatmeal. 72" long with fringed ends — gloriously warm.', 62, 'Clothing', 'handmade', 'shirt', 10, 1, 1, 5],
  ['Naturally Dyed Linen Shirt', 'Small-batch linen shirt dyed with avocado pits for a dusty rose tone. Breathable, relaxed fit.', 94, 'Clothing', 'handmade', 'shirt', 6, 1, 0, 5],
  ['Vintage Denim Trucker Jacket', 'Classic 1980s denim jacket with a perfectly broken-in feel. Size M. Faint fading at the elbows.', 118, 'Clothing', 'vintage', 'shirt', 1, 1, 1, 2],
  ['Hand-Embroidered Tote Bag', 'Heavy canvas tote with a hand-embroidered wildflower motif. Interior pocket, long straps.', 41, 'Accessories', 'handmade', 'basket', 19, 0, 1, 5],
  ['Woven Straw Sun Hat', 'Hand-woven raffia sun hat with a cotton band packable for travel. One size fits most.', 47, 'Accessories', 'handmade', 'hat', 13, 0, 0, 5],
  ['Leather Cardholder Wallet', 'Slim four-pocket cardholder in vegetable-tanned leather, stitched by hand. Ages to a rich patina.', 36, 'Accessories', 'handmade', 'book', 24, 0, 0, 1],
  ['Vintage Silk Scarf Collection', 'A lot of three 1970s silk scarves in bold geometric prints. Dry-cleaned and ready to wear.', 78, 'Accessories', 'vintage', 'basket', 3, 0, 1, 2],
  ['Abstract Landscape — Original Acrylic', 'Original 16x20" acrylic on stretched canvas. Signed, sealed and wired ready to hang. One of a kind.', 340, 'Art', 'handmade', 'frame', 1, 1, 1, 3],
  ['Coastal Sunrise Giclée Print', 'A giclée print of my bestselling coastal study on archival cotton rag. Signed edition of 100. Unframed.', 58, 'Art', 'handmade', 'print', 26, 1, 0, 3],
  ['Impressionist Oil Study', 'A small 8x10" oil study of morning light over fields, painted alla prima. Framed in raw oak.', 185, 'Art', 'handmade', 'frame', 2, 0, 0, 3],
  ['Vintage Travel Poster — Alps', 'An original 1960s lithograph travel poster. Light edge wear, vibrant colour, ships rolled in a tube.', 220, 'Art', 'vintage', 'print', 1, 0, 1, 2],
  ['Hand-Built Clay Trinket Dish', 'Pinched stoneware dish glazed in speckled cream — perfect for rings on a nightstand.', 24, 'Art', 'handmade', 'vase', 28, 0, 0, 1],
  ['Vintage Typewriter Key Cuff', 'A reclaimed typewriter key set into a brushed steel cuff. Adjustable, comfortable, endlessly conversational.', 52, 'Jewelry', 'vintage', 'ring', 5, 0, 0, 2],
  ['Indigo Shibori Table Runner', 'Hand-dyed indigo shibori cotton runner, 14x72". Each one dyed in small batches, so patterns vary.', 67, 'Home Decor', 'handmade', 'basket', 9, 0, 0, 5],
  ['Vintage Brass Compass', 'A working 1940s brass pocket compass in its original case. A beautiful desk object.', 135, 'Vintage', 'vintage', 'camera', 2, 1, 0, 2],
  ['Retro Film Camera — Working', 'A restored 1970s 35mm camera, tested with fresh film. Shutter accurate, light seals replaced.', 198, 'Vintage', 'vintage', 'camera', 1, 1, 1, 2],
  ['Antique Cast Iron Doorstop', 'A charming cast iron doorstop from the 1930s. Heavy, stable and full of character.', 74, 'Vintage', 'vintage', 'basket', 3, 0, 0, 2],
  ['Digital Icon Set — 200 Line Icons', '200 hand-drawn line icons in SVG and PNG. Perfect for web, apps and presentations. Commercial license included.', 19, 'Digital Products', 'digital', 'download', 999, 0, 0, 3],
  ['Knitted Beanie Pattern (PDF)', 'A downloadable knitting pattern for a ribbed beanie in 4 sizes. Includes chart and video links.', 12, 'Digital Products', 'digital', 'book', 999, 0, 0, 5],

  // ---- second wave: more listings across every category ----
  ['Teardrop Amethyst Pendant', 'A deep-purple amethyst teardrop suspended from a fine sterling chain. Hand-wrapped at the bail, no two stones match exactly.', 47, 'Jewelry', 'handmade', 'necklace', 12, 0, 1, 1],
  ['Hammered Stacking Signet Ring', 'A slim signet ring with a hand-hammered face, ready for a tiny initial stamp. Solid recycled silver.', 44, 'Jewelry', 'handmade', 'ring', 21, 0, 0, 1],
  ['Woven Seed Bead Cuff', 'Thousands of glass seed beads woven on a loom and finished with brass ends. Flexible, featherweight, one size.', 39, 'Jewelry', 'handmade', 'necklace', 8, 0, 0, 1],
  ['Vintage Bakelite Bangle', 'A chunky 1940s bakelite bangle in butterscotch cream. Passes the hot-water test, light wear throughout.', 65, 'Jewelry', 'vintage', 'ring', 2, 1, 1, 2],
  ['Speckled Ceramic Pour-Over', 'Wheel-thrown dripper that fits a standard carafe or mug. Speckled clay, matte glaze, dishwasher safe.', 56, 'Home Decor', 'handmade', 'mug', 14, 0, 1, 2],
  ['Hand-Carved Oak Candle Holder', 'Carved from a single block of white oak with a soft wax finish. Holds a standard taper candle.', 38, 'Home Decor', 'handmade', 'candle', 17, 0, 0, 2],
  ['Vintage Woven Picnic Basket', 'A 1950s willow picnic basket with its original enamel plates and cutlery straps. Ready for the park.', 88, 'Home Decor', 'vintage', 'basket', 2, 1, 1, 2],
  ['Terracotta Planter Pair', 'Two hand-thrown terracotta planters with drainage saucers. Raw outside, glazed within.', 42, 'Home Decor', 'handmade', 'vase', 19, 0, 0, 2],
  ['Hand-Loomed Wool Throw', 'Woven on a floor loom from soft highland wool in oatmeal and charcoal. 50×70", fringed ends.', 128, 'Home Decor', 'handmade', 'frame', 5, 1, 0, 5],
  ['Block-Printed Cushion Cover', 'Hand block-printed cotton with carved indigo motifs. 18" square, hidden zip, cover only.', 36, 'Home Decor', 'handmade', 'basket', 22, 0, 0, 5],
  ['Notion Habit Tracker Template', 'A beautifully linked Notion dashboard for habits, weekly reviews and streaks. Lifetime updates included.', 15, 'Digital Products', 'digital', 'download', 999, 0, 1, 3],
  ['Rustic Monogram Font Pair', 'Two hand-lettered display fonts with 220 ligatures and accents. OTF + TTF, commercial license included.', 26, 'Digital Products', 'digital', 'print', 999, 1, 0, 3],
  ['Social Media Canva Bundle', '60 editable post templates in three colour stories. Swap text and images in minutes.', 32, 'Digital Products', 'digital', 'download', 999, 0, 1, 3],
  ['Hand-Crochet Slouch Beanie', 'Croched from a soft alpaca blend in a relaxed slouch fit. Four colourways, one size.', 34, 'Clothing', 'handmade', 'hat', 16, 0, 1, 5],
  ['Waxed Canvas Market Tote', '18oz waxed canvas with leather handles and a riveted base. Ages into a rich, waxy patina.', 52, 'Accessories', 'handmade', 'basket', 11, 1, 0, 2],
  ['Vintage Bridle Leather Belt', 'A 1970s bridle leather belt with a solid brass buckle. Size 34, beautifully patinated.', 58, 'Accessories', 'vintage', 'watch', 3, 0, 0, 2],
  ['Linen-Bound Sketchbook', 'Hand-sewn sketchbook with 120 pages of heavy cartridge paper. Lies completely flat.', 40, 'Gifts', 'handmade', 'book', 13, 0, 0, 3],
  ['Enamel Moon Phase Pin Set', 'Three hard-enamel pins — crescent, half and full moon. Polished gold plating, rubber clutches.', 18, 'Gifts', 'handmade', 'crown', 34, 0, 1, 1],
  ['Custom House Portrait Watercolour', 'Send a photo of your home and I’ll paint it in loose watercolour. Digital file delivered in 5 days.', 72, 'Gifts', 'handmade', 'frame', 6, 1, 1, 3],
  ['Vintage Botanical Nursery Print', 'A 1960s lithograph of alpine wildflowers in its original maple frame. Glass intact, gentle wear.', 46, 'Art', 'vintage', 'print', 1, 0, 1, 2],
];

// review seeds — wider pool, ratings spread so aggregates look real
const reviewTexts = [
  ['Absolutely stunning — the photos don\'t do it justice. Arrived beautifully packaged and even nicer in person.', 5],
  ['Great quality and fast shipping. I get compliments every time I wear it.', 5],
  ['Really lovely piece, slightly smaller than expected but I love it anyway.', 4],
  ['Exactly as described. The seller was super responsive to my questions.', 5],
  ['Good value for the price. Would order again.', 4],
  ['Handmade quality shines through. You can tell a real person made this.', 5],
  ['Arrived quickly and carefully wrapped. Perfect gift — my sister loved it.', 5],
  ['Nice item, took a little longer to ship than I hoped.', 3],
  ['The craftsmanship is gorgeous and it looks just like the photos.', 5],
  ['Packaging was thoughtful — even a handwritten note. Would absolutely buy again.', 5],
  ['Solid piece for the money. The finish is a touch lighter than pictured.', 4],
  ['I\'ve ordered three times now and the quality is consistent every time.', 5],
  ['Colour is slightly different in person but still beautiful.', 4],
  ['Shipped the same day I ordered it. Impressed!', 5],
  ['Lovely weight and feel. Exactly what I was looking for.', 5],
  ['Works as described, though the instructions could be clearer.', 3],
  ['You can feel the quality the moment you pick it up.', 5],
  ['Second one I\'ve bought — buying a third for my mum.', 5],
  ['Delicate and pretty, just be careful with it near water.', 4],
  ['Better than the mass-produced version I returned last month.', 5],
  ['Everything arrived in one piece and on time. Happy customer.', 4],
  ['The details are lovely up close — stitching, glaze, all of it.', 5],
  ['Good, not perfect: mine had a tiny mark, but the seller sorted it fast.', 4],
  ['This has become my everyday go-to. Highly recommend.', 5],
  ['Simple, well made and reasonably priced.', 4],
  ['Seller answered my custom request within an hour. Wonderful experience.', 5],
];

async function seed() {
  // ---------- categories ----------
  let catCount = await count('SELECT COUNT(*) AS c FROM categories');
  if (catCount === 0) {
    for (let i = 0; i < categories.length; i++) {
      const [name, slug, description, glyph] = categories[i];
      const image = writeSvg(`categories/${slug}.svg`, categorySvg(i, name));
      await run(
        'INSERT INTO categories (name, slug, description, image) VALUES (?,?,?,?)',
        [name, slug, description, image]
      );
    }
    console.log(`  + ${categories.length} categories`);
  }

  // ---------- users ----------
  let userCount = await count('SELECT COUNT(*) AS c FROM users');
  const sellerIds = [];
  let buyerId = null;
  if (userCount === 0) {
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const hash = await bcrypt.hash(u.password, 10);
      const initials = u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
      const avatar = writeSvg(`avatars/${u.username}.svg`, avatarSvg(i, initials));
      await run(
        `INSERT INTO users (name, username, email, password_hash, role, avatar, bio, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [u.name, u.username, u.email, hash, u.role, avatar, u.bio || null,
         now().replace(' ', 'T') + 'Z']
      );
      const id = await lastId();
      if (u.role === 'seller') sellerIds.push(id);
      else buyerId = id;
    }
    console.log(`  + ${users.length} users (login: ava@example.com / Password123!)`);
  } else {
    const buyers = await db.execute(`SELECT id FROM users WHERE role != 'seller' ORDER BY id LIMIT 1`);
    const sellers = await db.execute(`SELECT id FROM users WHERE role = 'seller' ORDER BY id`);
    buyerId = buyers.rows.length ? Number(buyers.rows[0].id) : null;
    for (const s of sellers.rows) sellerIds.push(Number(s.id));
  }

  // ---------- products ----------
  let prodCount = await count('SELECT COUNT(*) AS c FROM products');
  if (prodCount === 0) {
    await loadPhotoPools();
    const glyphs = ['ring', 'necklace', 'mug', 'vase', 'frame', 'shirt', 'gift', 'crown', 'watch', 'download', 'print', 'lamp', 'camera', 'book', 'candle', 'basket', 'hat'];
    for (let i = 0; i < products.length; i++) {
      const [title, description, price, category, type, glyph, inventory, featured, trending, sellerIdx] = products[i];
      const sellerIdx0 = (sellerIdx - 1) % sellerIds.length;
      const sellerId = sellerIds[sellerIdx0] || sellerIds[0] || 2;
      const catSlug = (categories.find((c) => c[0] === category) || [, 'handmade'])[1];
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
      // Real photographs from the downloaded pool when available, otherwise
      // the generated artwork — so a fresh database looks the same as an
      // existing one once `npm run db:photos` has been run.
      const photos = photosFor(catSlug, i, 3);
      const images = JSON.stringify(photos.length === 3 ? photos : [
        writeSvg(`products/${slug}-1.svg`, productSvg(i * 3, glyph, title)),
        writeSvg(`products/${slug}-2.svg`, productSvg(i * 3 + 1, glyphs[(i + 5) % glyphs.length], title)),
        writeSvg(`products/${slug}-3.svg`, productSvg(i * 3 + 2, glyphs[(i + 9) % glyphs.length], title)),
      ]);
      const daysAgo = (i % 30) + 1;
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
      await run(
        `INSERT INTO products
          (seller_id, title, description, price, category, product_type, images, inventory,
           is_unlimited, is_featured, is_trending, rating, review_count, location, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sellerId, title, description, price, catSlug, type, images,
         type === 'digital' ? 0 : inventory,
         type === 'digital' ? 1 : 0,
         featured, trending, 0, 0,
         users[sellerIdx0 + 1]?.location || 'United States',
         createdAt, createdAt]
      );
    }
    console.log(`  + ${products.length} products`);
  }

  // ---------- reviews ----------
  // Every listing gets its own spread of reviews (2–5 each) from the buyer
  // pool, with varied text and ratings, then aggregates are recomputed.
  let reviewCount = await count('SELECT COUNT(*) AS c FROM product_reviews');
  if (reviewCount === 0 && buyerId) {
    const buyers = await db.execute(`SELECT id FROM users WHERE role != 'seller' ORDER BY id`);
    const reviewerIds = buyers.rows.map((x) => Number(x.id));
    const prods = await db.execute('SELECT id FROM products ORDER BY id');
    let total = 0;
    for (const row of prods.rows) {
      const pid = Number(row.id);
      const n = 2 + (pid % 4); // 2–5 reviews per listing
      for (let k = 0; k < n && k < reviewerIds.length; k++) {
        const [text, rating] = reviewTexts[(pid * 3 + k * 7) % reviewTexts.length];
        const daysBack = 1 + ((pid + k * 5) % 45);
        const ts = new Date(Date.now() - daysBack * 86400000).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
        await run(
          `INSERT OR IGNORE INTO product_reviews (product_id, user_id, rating, review_text, created_at, updated_at)
           VALUES (?,?,?,?,?,?)`,
          [pid, reviewerIds[k], rating, text, ts, ts]
        );
        total++;
      }
    }
    // recompute product rating aggregates
    await run(`
      UPDATE products SET
        rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = products.id), 0),
        review_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = products.id)
    `);
    console.log(`  + ${total} reviews across ${prods.rows.length} listings + rating aggregates`);
  }

  // ---------- wishlist ----------
  let wishCount = await count('SELECT COUNT(*) AS c FROM wishlist');
  if (wishCount === 0 && buyerId) {
    const prows = await db.execute('SELECT id FROM products ORDER BY id LIMIT 6');
    for (const row of prows.rows) {
      await run('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?,?)', [buyerId, Number(row.id)]);
    }
    console.log('  + wishlist entries');
  }

  console.log('Seed complete.');
  console.log('Demo logins — buyer: ava@example.com / Password123! | seller: maya@example.com / Password123!');
  db.close();
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exitCode = 1;
});
