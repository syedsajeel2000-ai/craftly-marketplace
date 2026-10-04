/**
 * Seller directory — /shops
 *
 * Every shop on the marketplace, searchable and ranked by how much they sell.
 * Each card opens the seller's public storefront at /shop/:username.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { Button, Stars, EmptyState, ErrorState, PageLoader, SafeImage } from '../components/ui.jsx';

const PER_PAGE = 24;

export default function Shops() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const page = Number(params.get('page')) || 1;

  const [data, setData] = useState(null);
  const [term, setTerm] = useState(q);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.get(`/api/shops?q=${encodeURIComponent(q)}&page=${page}&limit=${PER_PAGE}`, { signal: controller.signal })
      .then(setData)
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [q, page]);

  useEffect(() => { setTerm(q); }, [q]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || (k === 'page' && v === 1)) next.delete(k); else next.set(k, String(v));
    });
    setParams(next, { replace: true });
  };

  const submit = (e) => {
    e.preventDefault();
    update({ q: term.trim(), page: 1 });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-ink-950 sm:text-4xl">Meet the makers</h1>
        <p className="mt-2 text-ink-500">
          {data ? `${data.total} independent ${data.total === 1 ? 'seller' : 'sellers'} on Craftly.` : 'Loading sellers…'}
          {' '}Every shop is a small studio — open one to see what they make.
        </p>
      </header>

      <form onSubmit={submit} className="mt-6 max-w-md" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search shops by name…"
            aria-label="Search shops"
            className="w-full rounded-full border border-ink-100 bg-white py-2.5 pl-10 pr-4 text-sm text-ink-800 shadow-sm outline-none transition placeholder:text-ink-300 focus:border-brand-300"
          />
        </div>
      </form>

      {error ? (
        <div className="mt-10"><ErrorState message={error} onRetry={() => window.location.reload()} /></div>
      ) : loading && !data ? (
        <PageLoader label="Loading shops…" />
      ) : data?.shops.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon="products"
            title="No shops found"
            description={`Nothing matches "${q}". Try a different name.`}
            actionLabel="Clear search"
            actionTo="/shops"
          />
        </div>
      ) : (
        <>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.shops.map((shop, i) => (
              <motion.li
                key={shop.username}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 11) * 0.02 }}
              >
                <Link
                  to={`/shop/${shop.username}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
                >
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={shop.avatar}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full bg-ink-50 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900 transition group-hover:text-brand-700">{shop.name}</p>
                      <p className="truncate text-xs text-ink-400">@{shop.username}</p>
                    </div>
                  </div>
                  {shop.bio && <p className="line-clamp-2 text-xs leading-relaxed text-ink-500">{shop.bio}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <Stars rating={shop.rating} count={shop.review_count} />
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600">
                      <Store className="h-3 w-3" aria-hidden />
                      {shop.listings}
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>

          {data.pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Shop pages">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                ← Previous
              </Button>
              <span className="text-sm text-ink-500">Page {data.page} of {data.pages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => update({ page: page + 1 })}>
                Next →
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
