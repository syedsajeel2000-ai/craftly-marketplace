/** Homepage — hero, featured, trending, categories, handmade/vintage/digital, seller CTA. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BadgeCheck, Hammer, Sparkles, Timer, Download, Store, Truck, ShieldCheck, HeartHandshake } from 'lucide-react';
import { api } from '../lib/api.js';
import ProductCard from '../components/ProductCard.jsx';
import { ProductGridSkeleton, ErrorState, Stars, SafeImage } from '../components/ui.jsx';
import { Reveal, heroStagger, heroItem, EASE } from '../components/motion.jsx';

const TYPE_META = {
  handmade: { title: 'Handmade finds', copy: 'Made by hand, made for you.', icon: Hammer, to: '/marketplace?type=handmade', cta: 'Shop handmade' },
  vintage: { title: 'Vintage treasures', copy: 'Pieces with a past, ready for a future.', icon: Timer, to: '/marketplace?type=vintage', cta: 'Explore vintage' },
  digital: { title: 'Digital downloads', copy: 'Instant files for makers and dreamers.', icon: Download, to: '/marketplace?type=digital', cta: 'Browse downloads' },
};

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.get('/api/products/meta/home'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const tilesY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const badgeY = useTransform(scrollYProgress, [0, 1], [0, 55]);
  const orbAY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const orbBY = useTransform(scrollYProgress, [0, 1], [0, -45]);

  return (
    <div>
      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-[#fff7ef] to-amber-50">
        <motion.div aria-hidden style={{ y: orbAY }} className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" />
        <motion.div aria-hidden style={{ y: orbBY }} className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="mx-auto grid max-w-[1400px] items-center gap-8 px-5 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:py-24">
          <motion.div variants={heroStagger} initial="hidden" animate="show">
            <motion.span variants={heroItem} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-brand-800">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Handmade · Vintage · Digital
            </motion.span>
            <motion.h1 variants={heroItem} className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink-950 sm:text-5xl lg:text-6xl">
              Find things you’ll <span className="relative text-brand-600">love<svg viewBox="0 0 220 24" aria-hidden className="absolute -bottom-2 left-0 w-full"><path d="M4 17c40-10 150-14 212-6" fill="none" stroke="#fb8c2f" strokeWidth="5" strokeLinecap="round" /></svg></span>,<br className="hidden sm:block" /> made by people who care.
            </motion.h1>
            <motion.p variants={heroItem} className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-600 sm:text-base">
              Craftly is a marketplace for independent makers — hand-forged jewellery, restored vintage pieces and instant digital downloads, all from real human beings.
            </motion.p>
            <motion.div variants={heroItem} className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/marketplace" className="btn inline-flex items-center gap-2 rounded-full bg-ink-900 px-7 py-3.5 text-sm font-semibold text-white shadow-card transition hover:bg-ink-700 active:scale-95">
                Start shopping <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/seller?setup=1" className="btn inline-flex items-center gap-2 rounded-full border border-ink-300 bg-white px-7 py-3.5 text-sm font-semibold text-ink-800 transition hover:border-ink-400 hover:bg-ink-50 active:scale-95">
                <Store className="h-4 w-4" aria-hidden /> Open a shop
              </Link>
            </motion.div>
            {data?.stats && (
              <motion.dl variants={heroItem} className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
                {[
                  [data.stats.products.toLocaleString(), 'Live listings', '/marketplace'],
                  [data.stats.sellers.toLocaleString(), 'Independent sellers', '/shops'],
                  [data.stats.orders.toLocaleString(), 'Orders delivered', null],
                ].map(([v, l, to]) => (
                  <div key={l}>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{l}</dt>
                    <dd className="font-display text-2xl font-semibold text-ink-950">
                      {to ? (
                        <Link to={to} className="underline-offset-4 transition hover:text-brand-700 hover:underline">{v}</Link>
                      ) : v}
                    </dd>
                  </div>
                ))}
              </motion.dl>
            )}
          </motion.div>

          <div className="relative hidden lg:block">
            <motion.div style={{ y: tilesY }}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['/images/photos/jewelry-08yhk7n.jpg', 'Hand-forged ring'],
                  ['/images/photos/textiles-0f673tb.jpg', 'Woven wall hanging'],
                  ['/images/photos/art-0gcezli.jpg', 'Botanical prints'],
                  ['/images/photos/home-decor-0alc7rq.jpg', 'Brass candelabra'],
                ].map(([src, alt], i) => (
                  <motion.div
                    key={alt}
                    initial={{ opacity: 0, y: 36, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.65, ease: EASE, delay: 0.3 + i * 0.1 }}
                    className={`overflow-hidden rounded-3xl border border-white/70 bg-white shadow-card ${i % 2 ? 'mt-8' : ''}`}
                  >
                    <motion.div animate={{ y: [0, -9, 0] }} transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.35 }}>
                      <SafeImage src={src} alt={alt} className="h-44 w-full object-cover xl:h-52" />
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div style={{ y: badgeY }} className="absolute -left-6 top-1/3">
              <div className="rotate-[-6deg]">
                <motion.span
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="block rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-ink-800 shadow-pop"
                >
                  4.8★ average rating
                </motion.span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* value strip */}
        <Reveal className="border-t border-brand-100/70 bg-white/70" delay={0.35} y={16}>
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-4 px-5 py-5 text-xs sm:text-sm lg:grid-cols-4 lg:px-8">
            {[[Truck, 'Free shipping over $50'], [ShieldCheck, 'Secure demo checkout'], [BadgeCheck, 'Verified handmade sellers'], [HeartHandshake, '30-day returns']].map(([Icon, text]) => (
              <div key={text} className="flex items-center gap-2.5 text-ink-600">
                <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        {/* ============ FEATURED ============ */}
        <Section
          eyebrow="Editor’s picks" title="Featured products"
          description="Hand-selected pieces our sellers are proud of."
          href="/marketplace?sort=recommended" linkLabel="See all featured"
          loading={loading} error={error} onRetry={load}
          items={data?.featured}
          empty="No featured products yet."
        />

        {/* ============ TRENDING ============ */}
        <Section
          eyebrow="Popular right now" title="Trending this week"
          description="What shoppers are loving, straight from the database."
          href="/marketplace?sort=trending" linkLabel="See all trending"
          loading={loading} error={error} onRetry={load}
          items={data?.trending}
          empty="Nothing trending yet."
          tone="warm"
        />

        {/* ============ CATEGORIES ============ */}
        <Reveal as="section" className="py-10 sm:py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Explore</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-950 sm:text-3xl">Shop by category</h2>
            </div>
            <Link to="/marketplace" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">All categories →</Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton aspect-[4/3] rounded-2xl" />)}
            </div>
          ) : (
            <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
              {data?.categories?.slice(0, 10).map((cat) => (
                <Link key={cat.id} to={`/category/${cat.slug}`} className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={cat.image} alt={`${cat.name} category`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/85 to-transparent p-3.5 pt-8">
                    <p className="font-display text-sm font-semibold text-white">{cat.name}</p>
                    <p className="text-[11px] text-white/75">{cat.product_count} items</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Reveal>

        {/* ============ TYPE SECTIONS ============ */}
        {['handmade', 'vintage', 'digital'].map((type, idx) => (
          <TypeSection
            key={type}
            meta={TYPE_META[type]}
            items={data?.[type]}
            loading={loading}
            error={error}
            onRetry={load}
            flip={idx % 2 === 1}
          />
        ))}

        {/* ============ TOP RATED ============ */}
        <Reveal as="section" className="py-10 sm:py-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Loved by buyers</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink-950 sm:text-3xl">Highest rated</h2>
            </div>
            <Link to="/marketplace?sort=rating" className="text-sm font-semibold text-brand-700 hover:underline">See all →</Link>
          </div>
          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : (
            <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {(data?.featured || []).filter((p) => p.rating >= 4.5).slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
              {(data?.featured || []).filter((p) => p.rating >= 4.5).length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-ink-500">No rated products yet.</p>
              )}
            </div>
          )}
        </Reveal>

        {/* ============ SELLER CTA ============ */}
        <Reveal as="section" className="my-10 overflow-hidden rounded-3xl bg-ink-950 px-6 py-12 text-center sm:py-16" y={30}>
          <div className="mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-300">
              <Store className="h-3.5 w-3.5" aria-hidden /> For makers
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Turn what you make into what you earn.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-300 sm:text-base">
              Open a Craftly shop in minutes. List products, manage inventory, track orders and get paid — no listing fees in this demo.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/seller?setup=1" className="btn rounded-full bg-brand-500 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95">
                Open your shop
              </Link>
              <Link to="/help" className="btn rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95">
                Seller handbook
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Section({ eyebrow, title, description, href, linkLabel, items, loading, error, onRetry, empty, tone }) {
  return (
    <Reveal as="section" className="py-10 sm:py-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink-950 sm:text-3xl">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        <Link to={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">{linkLabel} →</Link>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : loading ? (
        <ProductGridSkeleton count={4} />
      ) : !items?.length ? (
        <p className={`rounded-2xl border border-dashed px-6 py-10 text-center text-sm ${tone === 'warm' ? 'border-brand-200 bg-brand-50/50 text-brand-800' : 'border-ink-200 bg-white text-ink-500'}`}>
          {empty}
        </p>
      ) : (
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </Reveal>
  );
}

function TypeSection({ meta, items, loading, error, onRetry, flip }) {
  const Icon = meta.icon;
  return (
    <Reveal as="section" className="py-10 sm:py-14">
      <div className={`mb-6 flex flex-wrap items-end justify-between gap-4 ${flip ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex items-start gap-4 ${flip ? 'sm:text-right' : ''}`}>
          <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700 sm:grid">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">{meta.title}</h2>
            <p className="mt-1 text-sm text-ink-500">{meta.copy}</p>
          </div>
        </div>
        <Link to={meta.to} className="text-sm font-semibold text-brand-700 hover:underline">{meta.cta} →</Link>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : loading ? (
        <ProductGridSkeleton count={4} />
      ) : !items?.length ? (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">
          No products in this collection yet.
        </p>
      ) : (
        <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </Reveal>
  );
}
