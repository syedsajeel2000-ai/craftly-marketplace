/**
 * Public seller storefront — /shop/:username
 *
 * Anyone can open a seller, not just the signed-in owner: the seller dashboard
 * at /seller/* is private, this is the public face of the same shop.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Store, Star, Package, CalendarDays, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import ProductCard from '../components/ProductCard.jsx';
import { Button, EmptyState, ErrorState, PageLoader, ProductGridSkeleton, SafeImage } from '../components/ui.jsx';
import { Reveal } from '../components/motion.jsx';

const SORTS = [
  ['Recommended', 'recommended'],
  ['Newest', 'newest'],
  ['Highest Rated', 'rating'],
  ['Price: Low to High', 'price_asc'],
  ['Price: High to Low', 'price_desc'],
];

const memberSince = (value) => {
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T').replace(/Z$/, ''));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export default function Shop() {
  const { username } = useParams();
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') || 'recommended';
  const page = Number(params.get('page')) || 1;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === 'recommended' || v === 1) next.delete(k);
      else next.set(k, String(v));
    });
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.get(`/api/shops/${encodeURIComponent(username)}?sort=${sort}&page=${page}`, { signal: controller.signal })
      .then(setData)
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [username, sort, page]);

  useEffect(() => {
    if (data?.seller) document.title = `${data.seller.name} – Craftly`;
    return () => { document.title = 'Craftly – handmade, vintage & digital goods'; };
  }, [data?.seller]);

  if (loading && !data) return <PageLoader label="Opening shop…" />;

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
        <div className="mt-6 text-center">
          <Link to="/marketplace" className="btn">Back to marketplace</Link>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { seller, products, categories, total, has_more, page: currentPage } = data;
  const since = memberSince(seller.member_since);

  const stats = [
    { icon: Package, label: 'Listings', value: seller.listings },
    { icon: Star, label: 'Reviews', value: seller.review_count },
    { icon: Store, label: 'In stock', value: seller.in_stock },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/shops"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All shops
      </Link>

      {/* ---- Shop header ---- */}
      <Reveal as="header" className="overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card">
        <div className="h-24 bg-gradient-to-r from-brand-100 via-clay-100 to-evergreen-100 sm:h-32" />
        <div className="-mt-12 flex flex-col gap-4 px-5 pb-6 sm:-mt-14 sm:flex-row sm:items-end sm:px-8">
          <SafeImage
            src={seller.avatar}
            alt=""
            className="h-24 w-24 shrink-0 rounded-full border-4 border-white bg-white object-cover shadow-card sm:h-28 sm:w-28"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">{seller.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-400">
              <span>@{seller.username}</span>
              {since && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Member since {since}
                </span>
              )}
            </p>
          </div>
          <dl className="flex shrink-0 gap-5 sm:gap-7">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center">
                <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-ink-950">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {seller.bio && (
          <p className="border-t border-ink-100 px-5 py-4 text-sm leading-relaxed text-ink-600 sm:px-8">
            {seller.bio}
          </p>
        )}
      </Reveal>

      {/* ---- Category chips ---- */}
      {categories.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/category/${c.slug}`}
              className="rounded-full border border-ink-100 bg-white px-3.5 py-1.5 text-xs font-medium capitalize text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {c.slug.replace(/-/g, ' ')} <span className="text-ink-400">({c.product_count})</span>
            </Link>
          ))}
        </div>
      )}

      {/* ---- Listings ---- */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          {total} listing{total === 1 ? '' : 's'} from {seller.name}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="shop-sort" className="text-xs font-medium text-ink-400">Sort</label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="rounded-xl border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-700 outline-none focus:border-brand-300"
          >
            {SORTS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="mt-6"><ProductGridSkeleton count={12} /></div>
      ) : products.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="This shop has no active listings"
            description="The seller may have paused everything for now — browse the marketplace instead."
            actionLabel="Browse marketplace"
            actionTo="/marketplace"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>

          {(currentPage > 1 || has_more) && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => update({ page: currentPage - 1 })}>
                ← Previous
              </Button>
              <span className="text-sm text-ink-500">Page {currentPage}</span>
              <Button variant="outline" size="sm" disabled={!has_more} onClick={() => update({ page: currentPage + 1 })}>
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
