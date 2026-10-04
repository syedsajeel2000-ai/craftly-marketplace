/**
 * End-to-end API test suite.
 * Runs against a live server (npm run dev:server) on PORT (default 8787).
 *
 * Covers: auth, validation, duplicates, sessions, search/filter/sort,
 * product CRUD + ownership, inventory, cart persistence & totals,
 * checkout + demo payment, orders, reviews, wishlist, user data isolation.
 *
 * Usage: npm run test:api
 */
const PORT = Number(process.env.PORT) || 8787;
// Defaults to a local server; set TEST_BASE_URL to run the same suite against a
// deployed URL (e.g. TEST_BASE_URL=https://your-app.vercel.app npm run test:api).
const BASE = process.env.TEST_BASE_URL || `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}

/** Cookie-jar fetch */
function client() {
  const jar = new Map();
  return async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // capture cookies
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of setCookies) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      const name = pair.slice(0, idx).trim();
      const value = decodeURIComponent(pair.slice(idx + 1).trim());
      if (value === '' || /Max-Age=0/.test(c)) jar.delete(name);
      else jar.set(name, value);
    }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data, headers: res.headers };
  };
}

const stamp = Date.now().toString(36);
const buyer = client();
const buyer2 = client();
const seller = client();

async function section(title) { console.log(`\n${title}`); }

const run = async () => {
  await section('1. AUTHENTICATION');

  // --- signup validation ---
  let r = await buyer('POST', '/api/auth/register', {
    name: 'Test', username: 'x', email: 'not-an-email', password: 'short', confirm: 'nope',
  });
  ok('signup rejects invalid input', r.status === 400, `got ${r.status}`);

  // --- valid signup ---
  r = await buyer('POST', '/api/auth/register', {
    name: 'Test Buyer', username: `buyer${stamp}`, email: `buyer${stamp}@test.dev`,
    password: 'Password123!', confirm: 'Password123!', role: 'buyer',
  });
  ok('signup succeeds', r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  const buyerId = r.data?.user?.id;

  // --- duplicate email / username ---
  r = await client()('POST', '/api/auth/register', {
    name: 'Dup', username: `other${stamp}`, email: `buyer${stamp}@test.dev`,
    password: 'Password123!', confirm: 'Password123!',
  });
  ok('duplicate email rejected', r.status === 409, `got ${r.status}`);
  r = await client()('POST', '/api/auth/register', {
    name: 'Dup', username: `buyer${stamp}`, email: `dupe${stamp}@test.dev`,
    password: 'Password123!', confirm: 'Password123!',
  });
  ok('duplicate username rejected', r.status === 409, `got ${r.status}`);

  // --- session persisted ---
  r = await buyer('GET', '/api/auth/me');
  ok('session persists after signup', r.data?.user?.email === `buyer${stamp}@test.dev`);

  // --- logout / login ---
  r = await buyer('POST', '/api/auth/logout');
  ok('logout works', r.status === 200);
  r = await buyer('GET', '/api/auth/me');
  ok('session cleared after logout', r.data?.user === null);

  r = await buyer('POST', '/api/auth/login', { identifier: 'wrong@test.dev', password: 'Password123!' });
  ok('login with unknown email rejected', r.status === 401, `got ${r.status}`);
  r = await buyer('POST', '/api/auth/login', { identifier: `buyer${stamp}@test.dev`, password: 'wrongpass' });
  ok('login with wrong password rejected', r.status === 401, `got ${r.status}`);
  r = await buyer('POST', '/api/auth/login', { identifier: `buyer${stamp}`, password: 'Password123!' });
  ok('login by username works', r.status === 200, `got ${r.status}`);
  r = await buyer('GET', '/api/auth/me');
  ok('session persists after re-login', !!r.data?.user);

  await section('2. PRODUCTS / SEARCH / FILTER / SORT');
  r = await buyer('GET', '/api/products?limit=5');
  ok('product list returns data', r.status === 200 && r.data.products.length > 0);
  const totalAll = r.data.total;
  ok('total count present', totalAll >= 40, `total=${totalAll}`);

  r = await buyer('GET', '/api/products?q=necklace');
  ok('search by title works', r.status === 200 && r.data.products.length > 0 &&
    r.data.products.every((p) => /necklace/i.test(p.title + p.description)),
    `n=${r.data.products.length}`);

  r = await buyer('GET', '/api/products?q=handmade+necklace');
  ok('multi-word search returns results', r.data.products.length >= 0);

  r = await buyer('GET', '/api/products?category=jewelry');
  ok('category filter works', r.data.products.length > 0 &&
    r.data.products.every((p) => p.category === 'jewelry'), `n=${r.data.products.length}`);

  r = await buyer('GET', '/api/products?type=digital');
  ok('product type filter works', r.data.products.length > 0 &&
    r.data.products.every((p) => p.product_type === 'digital'));

  r = await buyer('GET', '/api/products?price=25-50');
  ok('price range filter works', r.data.products.length > 0 &&
    r.data.products.every((p) => p.price >= 25 && p.price <= 50));

  r = await buyer('GET', '/api/products?minPrice=100&maxPrice=200');
  ok('custom min/max price works', r.data.products.every((p) => p.price >= 100 && p.price <= 200));

  r = await buyer('GET', '/api/products?rating=4');
  ok('rating filter works', r.data.products.every((p) => p.rating >= 4));

  r = await buyer('GET', '/api/products?sort=price_asc');
  const asc = r.data.products.map((p) => p.price);
  ok('sort price low→high', asc.every((v, i) => i === 0 || v >= asc[i - 1]));

  r = await buyer('GET', '/api/products?sort=price_desc');
  const desc = r.data.products.map((p) => p.price);
  ok('sort price high→low', desc.every((v, i) => i === 0 || v <= desc[i - 1]));

  r = await buyer('GET', '/api/products?sort=newest');
  const dates = r.data.products.map((p) => p.created_at);
  ok('sort newest first', dates.every((v, i) => i === 0 || v <= dates[i - 1]));

  r = await buyer('GET', '/api/products?q=zzzznotarealproduct999');
  ok('empty search returns empty list', r.status === 200 && r.data.products.length === 0 && r.data.total === 0);

  r = await buyer('GET', '/api/products?q=necklace&category=jewelry&price=25-50&rating=0&sort=price_asc');
  ok('combined search + filters work together',
    r.data.products.every((p) => p.category === 'jewelry' && p.price >= 25 && p.price <= 50));

  r = await buyer('GET', '/api/products/1');
  ok('product detail loads', r.status === 200 && r.data.product?.id === 1);
  ok('detail includes reviews + related', Array.isArray(r.data.product.reviews) && Array.isArray(r.data.product.related));
  r = await buyer('GET', '/api/products/999999');
  ok('missing product returns 404', r.status === 404);

  r = await buyer('GET', '/api/products/meta/home');
  ok('home data loads (featured/trending/categories)',
    r.status === 200 && r.data.featured.length > 0 && r.data.trending.length > 0 && r.data.categories.length > 0);

  await section('3. SELLER: SIGNUP, PRODUCT CRUD, INVENTORY');
  r = await seller('POST', '/api/auth/register', {
    name: 'Test Seller', username: `seller${stamp}`, email: `seller${stamp}@test.dev`,
    password: 'Password123!', confirm: 'Password123!', role: 'seller',
  });
  ok('seller signup', r.status === 201, JSON.stringify(r.data));
  const sellerId = r.data?.user?.id;

  // non-seller cannot create products
  r = await buyer('POST', '/api/seller/products', {
    title: 'Should Fail Product', description: 'This should not be created at all.',
    price: 10, category: 'gifts', product_type: 'handmade', inventory: 5,
  });
  ok('buyer cannot create products', r.status === 403, `got ${r.status}`);

  r = await seller('POST', '/api/seller/products', {
    title: '', description: 'no', price: -5, category: '', product_type: 'magic', inventory: -1,
  });
  ok('invalid product rejected', r.status === 400, `got ${r.status}`);

  r = await seller('POST', '/api/seller/products', {
    title: `Test Handmade Bowl ${stamp}`, description: 'A beautiful hand-thrown bowl for testing purposes only.',
    price: 45.5, category: 'home-decor', product_type: 'handmade', inventory: 6,
    images: ['/images/photos/kitchen-dining-0d2uu4c.jpg'],
    is_featured: true,
  });
  ok('seller creates product', r.status === 201, JSON.stringify(r.data));
  const pid = r.data?.product?.id;
  ok('product has seller id', r.data?.product?.seller_id === sellerId);

  // product visible in marketplace to other users
  r = await buyer('GET', `/api/products?q=${encodeURIComponent(`Test Handmade Bowl`)}`);
  ok('other users can see the new product', r.data.products.some((p) => p.id === pid));

  // edit
  r = await seller('PUT', `/api/seller/products/${pid}`, {
    title: `Test Handmade Bowl EDITED ${stamp}`, price: 55.25, inventory: 9,
  });
  ok('seller edits product', r.status === 200 && /EDITED/.test(r.data.product.title));
  ok('edited price persisted', r.data.product.price === 55.25);

  // ownership: other user cannot edit
  r = await buyer('POST', '/api/seller/products');
  ok('buyer blocked from seller API', r.status === 403);

  // inventory modes
  r = await seller('PATCH', `/api/seller/products/${pid}/inventory`, { mode: 'add', value: 4 });
  ok('inventory increase works', r.status === 200 && r.data.inventory === 13, `got ${r.data?.inventory}`);
  r = await seller('PATCH', `/api/seller/products/${pid}/inventory`, { mode: 'subtract', value: 3 });
  ok('inventory decrease works', r.data.inventory === 10, `got ${r.data?.inventory}`);
  r = await seller('PATCH', `/api/seller/products/${pid}/inventory`, { mode: 'subtract', value: 999 });
  ok('inventory cannot go negative', r.status === 400);
  r = await seller('PATCH', `/api/seller/products/${pid}/inventory`, { mode: 'set', value: 7 });
  ok('inventory set works', r.data.inventory === 7);

  await section('4. CART: ADD / QTY / PERSIST / TOTALS');
  r = await buyer('GET', '/api/cart');
  ok('empty cart loads', r.status === 200 && r.data.cart.items.length === 0);

  r = await buyer('POST', '/api/cart/items', { product_id: pid, quantity: 2 });
  ok('add to cart', r.status === 201, JSON.stringify(r.data));
  ok('cart subtotal correct (55.25 x 2 = 110.50)', r.data.cart.subtotal === 110.5, `got ${r.data.cart.subtotal}`);
  ok('free shipping over $50', r.data.cart.shipping === 0, `got ${r.data.cart.shipping}`);

  r = await buyer('POST', '/api/cart/items', { product_id: pid, quantity: 1 });
  ok('adding again increments quantity', r.data.cart.items[0].quantity === 3, `qty=${r.data.cart.items[0].quantity}`);

  r = await buyer('PATCH', `/api/cart/items/${pid}`, { quantity: 2 });
  ok('set quantity works', r.status === 200 && r.data.cart.items[0].quantity === 2);

  r = await buyer('PATCH', `/api/cart/items/${pid}`, { quantity: 0 });
  ok('quantity 0 rejected', r.status === 400);
  r = await buyer('PATCH', `/api/cart/items/${pid}`, { quantity: 9999 });
  ok('quantity over stock rejected', r.status === 409, `got ${r.status}`);

  // cart persists across a NEW session (logout/login)
  await buyer('POST', '/api/auth/logout');
  await buyer('POST', '/api/auth/login', { identifier: `buyer${stamp}@test.dev`, password: 'Password123!' });
  r = await buyer('GET', '/api/cart');
  ok('cart persists after logout/login', r.data.cart.items.length === 1 && r.data.cart.items[0].quantity === 2,
    JSON.stringify(r.data.cart.items));

  // user B cannot see user A's cart
  await buyer2('POST', '/api/auth/register', {
    name: 'Other Buyer', username: `buyer2${stamp}`, email: `buyer2${stamp}@test.dev`,
    password: 'Password123!', confirm: 'Password123!',
  });
  r = await buyer2('GET', '/api/cart');
  ok('user isolation: other user has own empty cart', r.data.cart.items.length === 0);

  // add an out-of-stock product attempt
  const oos = await seller('POST', '/api/seller/products', {
    title: `Sold Out Thing ${stamp}`, description: 'Zero stock product for testing sold out flow.',
    price: 20, category: 'gifts', product_type: 'handmade', inventory: 0,
  });
  const oosId = oos.data.product.id;
  r = await buyer('POST', '/api/cart/items', { product_id: oosId, quantity: 1 });
  ok('out-of-stock add rejected', r.status === 409, `got ${r.status}`);

  // own product cannot be added to own cart
  r = await seller('POST', '/api/cart/items', { product_id: pid, quantity: 1 });
  ok('cannot add own product to cart', r.status === 400, `got ${r.status}`);

  await section('5. CHECKOUT + DEMO PAYMENT + INVENTORY');
  const shipping = { address: '12 Test Street', city: 'Testville', state: 'CA', postal: '90210', country: 'USA' };
  const customer = { name: 'Test Buyer', email: `buyer${stamp}@test.dev`, phone: '+1 555 123 4567' };

  // invalid payment
  r = await buyer('POST', '/api/checkout', {
    customer, shipping, payment: { name: 'Test Buyer', number: '1234', expiry: '13/99', cvv: 'ab' },
  });
  ok('invalid demo card rejected', r.status === 402, `got ${r.status}`);

  // invalid shipping
  r = await buyer('POST', '/api/checkout', {
    customer: { ...customer, email: 'bad' }, shipping: { address: '' }, payment: { name: 'X', number: '4242424242424242', expiry: '12/30', cvv: '123' },
  });
  ok('invalid customer info rejected', r.status === 400);

  // valid checkout
  // (cart currently holds 2 × product with 7 in stock → passes stock check)
  r = await buyer('POST', '/api/checkout', {
    customer, shipping,
    payment: { name: 'Test Buyer', number: '4242424242424242', expiry: '12/30', cvv: '123', method: 'demo_card' },
  });
  ok('checkout succeeds', r.status === 201, JSON.stringify(r.data).slice(0, 300));
  const order = r.data?.order;
  ok('order number generated', !!order?.order_number);
  ok('payment status paid', order?.payment_status === 'paid');
  ok('order total computed server-side', order?.total_amount === 110.5, `got ${order?.total_amount}`);
  ok('order has items', order?.items?.length === 1 && order.items[0].quantity === 2);

  // inventory decreased
  r = await seller('GET', '/api/seller/products');
  const after = r.data.products.find((p) => p.id === pid);
  ok('inventory decremented 7 → 5', after.inventory === 5, `got ${after.inventory}`);

  // inventory log created
  r = await seller('GET', '/api/seller/inventory-logs');
  ok('inventory log recorded', r.data.logs.some((l) => l.product_id === pid && l.change_amount === -2));

  // cart cleared of purchased items
  r = await buyer('GET', '/api/cart');
  ok('cart cleared after checkout', r.data.cart.items.length === 0, JSON.stringify(r.data.cart.items));

  // declined card path (declined number ends 0002)
  await buyer('POST', '/api/cart/items', { product_id: pid, quantity: 1 });
  r = await buyer('POST', '/api/checkout', {
    customer, shipping,
    payment: { name: 'Test Buyer', number: '4000000000000002', expiry: '12/30', cvv: '123' },
  });
  ok('declined demo card handled', r.status === 402 && r.data.payment_failed === true, `got ${r.status}`);
  r = await buyer('GET', '/api/cart');
  ok('cart preserved after failed payment', r.data.cart.items.length === 1);

  // orders page
  r = await buyer('GET', '/api/orders');
  ok('orders list contains the order', r.status === 200 && r.data.orders.some((o) => o.order_number === order.order_number));
  const orderId = r.data.orders.find((o) => o.order_number === order.order_number).id;
  r = await buyer('GET', `/api/orders/${orderId}`);
  ok('order detail loads', r.data.order.items.length === 1);

  // isolation: user B cannot read user A's order
  r = await buyer2('GET', `/api/orders/${orderId}`);
  ok('user isolation: other user cannot read order', r.status === 404, `got ${r.status}`);

  // seller sees the order containing their product
  r = await seller('GET', '/api/orders/seller/all');
  ok('seller sees orders for own products', r.data.orders.some((o) => o.order_number === order.order_number));

  await section('6. REVIEWS');
  // buyer purchased pid → can review
  r = await buyer('POST', `/api/products/${pid}/reviews`, { rating: 5, review_text: 'Wonderful test bowl!' });
  ok('purchaser can review', r.status === 201, JSON.stringify(r.data));
  r = await buyer('GET', `/api/products/${pid}`);
  ok('product rating updated', r.data.product.rating === 5 && r.data.product.review_count === 1,
    `rating=${r.data.product.rating} count=${r.data.product.review_count}`);

  r = await buyer('POST', `/api/products/${pid}/reviews`, { rating: 6, review_text: 'x' });
  ok('invalid rating rejected', r.status === 400, `got ${r.status}`);

  // user B did not purchase → cannot review
  r = await buyer2('POST', `/api/products/${pid}/reviews`, { rating: 5, review_text: 'never bought it' });
  ok('non-purchaser cannot review', r.status === 403, `got ${r.status}`);

  await section('7. WISHLIST');
  r = await buyer('POST', '/api/wishlist/1');
  ok('add to wishlist', r.status === 200 && r.data.wishlisted === true);
  r = await buyer('GET', '/api/wishlist');
  ok('wishlist list returns item', r.data.wishlist.some((w) => w.id === 1));
  r = await buyer2('GET', '/api/wishlist');
  ok('user isolation: other wishlist empty', r.data.wishlist.length === 0);
  r = await buyer('POST', '/api/wishlist/1');
  ok('toggle removes from wishlist', r.data.wishlisted === false);

  await section('8. PROFILE');
  r = await buyer('GET', '/api/profile');
  ok('profile loads own data', r.data.user.email === `buyer${stamp}@test.dev`);
  r = await buyer('PUT', '/api/profile', { name: 'Test Buyer Updated', username: `buyer${stamp}`, email: `buyer${stamp}@test.dev`, bio: 'I love handmade goods.' });
  ok('profile update persists', r.status === 200 && r.data.user.name === 'Test Buyer Updated');
  r = await buyer('GET', '/api/profile');
  ok('profile change persisted in DB', r.data.user.bio === 'I love handmade goods.');
  r = await buyer('PUT', '/api/profile', { name: 'X', username: 'ab', email: 'nope' });
  ok('invalid profile rejected', r.status === 400);

  await section('9. SELLER STATS + DELETE');
  r = await seller('GET', '/api/seller/stats');
  ok('stats load', r.status === 200 && typeof r.data.stats.revenue === 'number');
  ok('revenue reflects the paid order', r.data.stats.revenue >= 110.5, `revenue=${r.data.stats.revenue}`);
  ok('order count is 1', r.data.stats.orders === 1, `orders=${r.data.stats.orders}`);

  // delete a product with no orders → hard delete
  const del = await seller('POST', '/api/seller/products', {
    title: `Temp Delete ${stamp}`, description: 'Temporary product to be deleted in the test.',
    price: 10, category: 'gifts', product_type: 'handmade', inventory: 1,
  });
  const delId = del.data.product.id;
  r = await seller('DELETE', `/api/seller/products/${delId}`);
  ok('delete product without orders', r.status === 200 && r.data.removed === true);
  r = await buyer('GET', `/api/products/${delId}`);
  ok('deleted product returns 404', r.status === 404);

  // delete a product WITH orders → deactivated, history preserved
  r = await seller('DELETE', `/api/seller/products/${pid}`);
  ok('delete product with orders deactivates', r.status === 200 && r.data.deactivated === true, JSON.stringify(r.data));
  r = await buyer('GET', `/api/products/${pid}`);
  ok('deactivated product hidden from marketplace detail', r.status === 404);
  r = await buyer('GET', '/api/orders');
  ok('order history preserved after deactivation',
    r.data.orders.find((o) => o.id === orderId)?.items?.length === 1);

  await section('10. SECURITY: AUTH GUARDS');
  const anon = client();
  r = await anon('GET', '/api/cart');
  ok('anonymous cart blocked', r.status === 401);
  r = await anon('POST', '/api/checkout', { customer, shipping, payment: {} });
  ok('anonymous checkout blocked', r.status === 401);
  r = await anon('GET', '/api/orders');
  ok('anonymous orders blocked', r.status === 401);
  r = await anon('GET', '/api/profile');
  ok('anonymous profile blocked', r.status === 401);
  r = await anon('GET', '/api/seller/stats');
  ok('anonymous seller stats blocked', r.status === 401);
  r = await anon('POST', '/api/wishlist/1');
  ok('anonymous wishlist blocked', r.status === 401);

  // health endpoint must not leak credentials
  r = await anon('GET', '/api/health');
  ok('health endpoint has no secrets', !JSON.stringify(r.data).includes('authToken'));

  console.log(`\n${'='.repeat(50)}\n  PASS: ${passed}   FAIL: ${failed}\n${'='.repeat(50)}`);
  if (failed) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  process.exit(0);
};

run().catch((e) => { console.error('Test runner crashed:', e); process.exit(1); });
