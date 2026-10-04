/**
 * Marketplace listing — search + filters + sort + pagination.
 * All results come from /api/products (Turso). Works for /marketplace and /category/:slug.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown, Search, Check } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import ProductCard from '../components/ProductCard.jsx';
import { EmptyState, ErrorState, ProductGridSkeleton, Button } from '../components/ui.jsx';
import { Reveal } from '../components/motion.jsx';

const PRICE_RANGES = [
  ['Under $25', 'under25'], ['$25 – $50', '25-50'], ['$50 – $100', '50-100'], ['$100+', 'over100'],
];
const SORTS = [
  ['Recommended', 'recommended'], ['Newest', 'newest'],
  ['Price: Low to High', 'price_asc'], ['Price: High to Low', 'price_desc'],
  ['Highest Rated', 'rating'],
];
const TYPES = [['Handmade', 'handmade'], ['Vintage', 'vintage'], ['Digital', 'digital']];

export default function Marketplace() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // local mirror of URL state
  const q = params.get('q') || '';
  const category = slug || params.get('category') || '';
  const type = params.get('type') || '';
  const price = params.get('price') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const rating = params.get('rating') || '';
  const availability = params.get('availability') || '';
  const sort = params.get('sort') || 'recommended';
  const page = Number(params.get('page')) || 1;

  const [result, setResult] = useState({ products: [], total: 0, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(!!(minPrice || maxPrice));
  const firstRender = useRef(true);

  // keep URL in sync (single source of truth)
  const update = useCallback((patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || v === 'all') next.delete(k);
      else next.set(k, v);
    });
    if (resetPage && !('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  // load categories once (for filter sidebar)
  useEffect(() => {
    api.get('/api/products/meta/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  // load products whenever query params change
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/api/products${qs({
          q, category, type, price, minPrice, maxPrice,
          rating: rating || undefined, availability, sort, page, limit: 24,
        })}`, { signal: controller.signal });
        if (!cancelled) setResult(data);
      } catch (err) {
        if (err.name !== 'AbortError' && !cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, firstRender.current ? 0 : 180); // debounce typing
    firstRender.current = false;
    return () => { cancelled = true; controller.abort(); clearTimeout(t); };
  }, [q, category, type, price, minPrice, maxPrice, rating, availability, sort, page]);

  const activeCount = useMemo(() =>
    [q, type, price, minPrice, maxPrice, rating, availability].filter(Boolean).length
    + (category ? 1 : 0), [q, type, price, minPrice, maxPrice, rating, availability, category]);

  const clearAll = () => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);        // keep search term when clearing filters
    if (sort !== 'recommended') next.set('sort', sort);
    if (slug) {
      const s = next.toString();
      navigate(`/category/${slug}${s ? `?${s}` : ''}`, { replace: true });
    } else setParams(next, { replace: true });
    setDrawerOpen(false);
  };

  const heading = category
    ? (categories.find((c) => c.slug === category)?.name || category.replace(/-/g, ' '))
    : q ? `Results for “${q}”` : 'Marketplace';

  const filtersUI = (
    <FilterPanel
      q={q} category={category} type={type} price={price} minPrice={minPrice} maxPrice={maxPrice}
      rating={rating} availability={availability} sort={sort}
      categories={categories} update={update} clearAll={clearAll}
      pickCategory={(slug) => {
        // category routes own the URL; preserve the other active filters
        const next = new URLSearchParams(params);
        next.delete('page');
        next.delete('category');
        const search = next.toString();
        navigate(slug ? `/category/${slug}${search ? `?${search}` : ''}` : `/marketplace${search ? `?${search}` : ''}`, { replace: true });
      }}
      customOpen={customOpen} setCustomOpen={setCustomOpen}
      activeCount={activeCount}
    />
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-ink-400">
        <button type="button" onClick={() => navigate('/')} className="hover:text-brand-700">Home</button>
        <span className="mx-1.5">/</span>
        <button type="button" onClick={() => navigate('/marketplace')} className="hover:text-brand-700">Marketplace</button>
        {category && (<><span className="mx-1.5">/</span><span className="text-ink-600 capitalize">{heading}</span></>)}
        {q && !category && (<><span className="mx-1.5">/</span><span className="text-ink-600">Search</span></>)}
      </nav>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold capitalize text-ink-950 sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-ink-500" role="status">
            {loading ? 'Searching…' : `${result.total} ${result.total === 1 ? 'product' : 'products'} found`}
            {activeCount > 0 && !loading && ` · ${activeCount} filter${activeCount > 1 ? 's' : ''} active`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* mobile filter toggle */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{activeCount}</span>
            )}
          </button>

          {/* sort */}
          <div className="relative">
            <label htmlFor="sort-select" className="sr-only">Sort products</label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              className="appearance-none rounded-full border border-ink-200 bg-white py-2.5 pl-4 pr-9 text-sm font-semibold text-ink-800 transition hover:border-ink-300 focus:border-brand-400 focus:outline-none"
            >
              {SORTS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-40 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">{filtersUI}</div>
        </aside>

        <div>
          {error ? (
            <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params))} />
          ) : loading ? (
            <ProductGridSkeleton count={8} />
          ) : result.products.length === 0 ? (
            <EmptyState
              icon="search"
              title="No products found."
              description={q ? `We couldn’t find anything matching “${q}”. Try a different search or clear your filters.` : 'Try removing some filters to widen your search.'}
              action={clearAll}
              actionLabel="Clear search & filters"
              secondary={<Button variant="outline" onClick={() => navigate('/marketplace')}>Browse everything</Button>}
            />
          ) : (
            <>
              <Reveal className="stagger grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                {result.products.map((p) => <ProductCard key={p.id} product={p} />)}
              </Reveal>

              {/* pagination */}
              {result.pages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, { resetPage: false })}>
                    ← Previous
                  </Button>
                  <span className="px-3 text-sm text-ink-500">Page {page} of {result.pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= result.pages} onClick={() => update({ page: String(page + 1) }, { resetPage: false })}>
                    Next →
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm animate-slide-left flex-col bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-ink-950">Filters</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close filters" className="rounded-full p-2 text-ink-500 transition hover:bg-ink-100">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{filtersUI}</div>
            <div className="border-t border-ink-100 p-4">
              <Button onClick={() => setDrawerOpen(false)} className="w-full">
                Show {result.total} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function FilterPanel({
  q, category, type, price, minPrice, maxPrice, rating, availability, sort,
  categories, update, clearAll, pickCategory, customOpen, setCustomOpen, activeCount,
}) {
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);

  useEffect(() => { setMin(minPrice); setMax(maxPrice); }, [minPrice, maxPrice]);

  const submitCustom = (e) => {
    e.preventDefault();
    update({ minPrice: min, maxPrice: max, price: '' });
  };

  const radio = (checked) =>
    `flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${checked ? 'bg-brand-50 font-semibold text-brand-800' : 'text-ink-600 hover:bg-ink-50'}`;

  const pick = pickCategory || ((slug) => update({ category: slug }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Filter by</h2>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <X className="h-3 w-3" aria-hidden /> Clear all
          </button>
        )}
      </div>

      {q && (
        <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1 truncate">“{q}”</span>
          <button type="button" onClick={() => update({ q: '' })} className="font-semibold text-brand-700 hover:underline">Clear</button>
        </div>
      )}

      {/* Category */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-800">Category</legend>
        <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          <button type="button" onClick={() => pick('')} className={radio(!category)}>
            All categories
          </button>
          {categories.map((c) => (
            <button key={c.slug} type="button" onClick={() => pick(c.slug)} className={radio(category === c.slug)}>
              <span className="flex-1 truncate">{c.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-ink-400">
                {c.product_count}
                {category === c.slug && <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden />}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Product type */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-800">Product type</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(([label, value]) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ type: type === value ? '' : value })}
              aria-pressed={type === value}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${type === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Price */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-800">Price</legend>
        <div className="space-y-0.5">
          {PRICE_RANGES.map(([label, value]) => (
            <button key={value} type="button" onClick={() => update({ price: price === value ? '' : value, minPrice: '', maxPrice: '' })} className={radio(price === value)}>
              <span>{label}</span>
              {price === value && <Check className="h-4 w-4" aria-hidden />}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setCustomOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          Custom range
          <ChevronDown className={`h-3.5 w-3.5 transition ${customOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {customOpen && (
          <form onSubmit={submitCustom} className="mt-2 flex items-center gap-2">
            <label className="sr-only" htmlFor="min-price">Minimum price</label>
            <input id="min-price" type="number" min="0" placeholder="Min" value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none" />
            <span className="text-ink-300">–</span>
            <label className="sr-only" htmlFor="max-price">Maximum price</label>
            <input id="max-price" type="number" min="0" placeholder="Max" value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none" />
            <button type="submit" className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-ink-700">Go</button>
          </form>
        )}
      </fieldset>

      {/* Rating */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-800">Rating</legend>
        <div className="space-y-0.5">
          {[['4★ & up', '4'], ['3★ & up', '3'], ['2★ & up', '2'], ['Any rating', '']].map(([label, value]) => (
            <button key={label} type="button" onClick={() => update({ rating: value })} className={radio(rating === value)}>
              <span>{label}</span>
              {rating === value && <Check className="h-4 w-4" aria-hidden />}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Availability */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-800">Availability</legend>
        <div className="space-y-0.5">
          <button type="button" onClick={() => update({ availability: availability === 'in' ? '' : 'in' })} className={radio(availability === 'in')}>
            <span>In stock only</span>
            {availability === 'in' && <Check className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
