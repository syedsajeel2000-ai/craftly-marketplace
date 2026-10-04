/**
 * Seller dashboard — /seller/* (index, products, products/new, products/:id,
 * inventory, orders, profile). Every panel reads and writes Turso through the
 * API; all queries are ownership-scoped on the server.
 * A buyer landing on /seller?setup=1 gets a "become a seller" flow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Routes, Route, Link, NavLink, useNavigate, useParams, useSearchParams, Navigate,
} from 'react-router-dom';
import {
  LayoutDashboard, Package, PlusCircle, Boxes, ClipboardList, Store, Settings,
  TrendingUp, DollarSign, AlertTriangle, Pencil, Trash2, Eye, EyeOff, X,
  ArrowRight, RefreshCw, Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, money, formatDate, timeAgo } from '../lib/api.js';
import {
  Button, EmptyState, ErrorState, SafeImage, TypeBadge, Spinner, PageLoader, Stars,
} from '../components/ui.jsx';

const inputCls =
  'mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';
const areaCls =
  'mt-1.5 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';

const NAV = [
  { to: '/seller', end: true, icon: LayoutDashboard, label: 'Overview' },
  { to: '/seller/products', icon: Package, label: 'Products' },
  { to: '/seller/inventory', icon: Boxes, label: 'Inventory' },
  { to: '/seller/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/seller/profile', icon: Settings, label: 'Shop profile' },
];

/* ============================================================ SHELL ============================================================ */
export default function Seller() {
  const { user, loading, isSeller, becomeSeller } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [setupBusy, setSetupBusy] = useState(false);

  if (loading) return <PageLoader label="Loading dashboard…" />;

  // not signed in
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          icon="seller"
          title="Sign in to open your shop"
          description="Create an account and start selling handmade, vintage or digital goods."
          action={() => navigate('/login', { state: { from: '/seller' } })}
          actionLabel="Sign in"
          secondary={<Link to="/register" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Create account</Link>}
        />
      </div>
    );
  }

  // buyer wants to become a seller (?setup=1 or first visit)
  if (!isSeller) {
    const wantsSetup = params.get('setup') === '1';
    const start = async () => {
      setSetupBusy(true);
      try {
        await becomeSeller();
        toast.success('Your shop is open — welcome, seller!');
        navigate('/seller', { replace: true });
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSetupBusy(false);
      }
    };
    return (
      <div className="mx-auto max-w-3xl px-5 py-14">
        <div className="animate-fade-up rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-card">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Store className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink-950">
            {wantsSetup ? 'Open your Craftly shop' : 'You’re a buyer — for now'}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-500">
            Switch to a seller account to create products, manage inventory, fulfil orders and track revenue —
            all from one dashboard. It takes one click and you can keep buying too.
          </p>
          <ul className="mx-auto mt-6 grid max-w-lg gap-2.5 text-left text-sm text-ink-600">
            {[
              'List unlimited products with images and pricing',
              'Track stock levels with a full inventory log',
              'See orders that contain your items, instantly',
              'Watch revenue trends in your overview',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-evergreen-500/10 text-evergreen-600">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" loading={setupBusy} onClick={start}>
              Become a seller <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <Link to="/" className="btn inline-flex items-center justify-center rounded-full border border-ink-200 px-6 py-3.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-50">
              Maybe later
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-7 sm:px-5 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* sidebar */}
        <aside className="min-w-0 lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-3xl border border-ink-100 bg-white p-3 shadow-card">
            <div className="mb-2 flex items-center gap-2.5 px-2 py-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <Store className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{user.name}’s shop</p>
                <p className="truncate text-xs text-ink-400">@{user.username}</p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Seller dashboard">
              {NAV.map(({ to, end, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      isActive ? 'bg-ink-900 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'}`}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </NavLink>
              ))}
              <NavLink
                to="/seller/products/new"
                className="flex shrink-0 items-center gap-2.5 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 lg:mt-2"
              >
                <PlusCircle className="h-4 w-4" aria-hidden /> Add product
              </NavLink>
            </nav>
          </div>
        </aside>

        {/* main panel */}
        <div className="min-w-0">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="products" element={<ProductsPanel />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id" element={<ProductForm />} />
            <Route path="inventory" element={<InventoryPanel />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="profile" element={<ShopProfile />} />
            <Route path="*" element={<Navigate to="/seller" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ OVERVIEW ============================================================ */
function StatCard({ icon: Icon, label, value, sub, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-evergreen-500/10 text-evergreen-600',
    ink: 'bg-ink-100 text-ink-600',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card sm:p-5">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </span>
      <p className="mt-3 font-display text-2xl font-semibold text-ink-950">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/seller/stats')
      .then((d) => setStats(d.stats))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div role="status">
        <div className="skeleton mb-5 h-8 w-56 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
        <div className="skeleton mt-5 h-56 rounded-3xl" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return <ErrorState message="No stats available." onRetry={load} />;

  const maxRev = Math.max(...stats.trend.map((t) => t.revenue), 1);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink-950">Shop overview</h1>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition hover:text-ink-900">
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={DollarSign} tone="green" label="Revenue" value={money(stats.revenue)} sub="from paid orders" />
        <StatCard icon={ClipboardList} tone="brand" label="Orders" value={stats.orders} sub={`${stats.pending_orders} awaiting fulfilment`} />
        <StatCard icon={Package} tone="ink" label="Products" value={stats.active_products} sub={`${stats.total_products} total (${stats.total_products - stats.active_products} hidden)`} />
        <StatCard icon={Boxes} tone="amber" label="Units in stock" value={stats.inventory_units} sub={stats.low_stock > 0 ? `${stats.low_stock} low-stock alerts` : 'stock healthy'} />
      </div>

      {/* revenue trend */}
      <section className="mt-5 rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-800">
          <TrendingUp className="h-4 w-4 text-evergreen-600" aria-hidden /> Revenue — last 6 months
        </h2>
        {stats.trend.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">No paid orders yet. Your chart fills in as soon as buyers check out.</p>
        ) : (
          <div className="mt-5 flex h-44 items-end gap-2.5 sm:gap-4">
            {stats.trend.map((t) => (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-ink-600">{money(t.revenue)}</span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all duration-700"
                  style={{ height: `${Math.max(6, (t.revenue / maxRev) * 120)}px` }}
                  role="img"
                  aria-label={`${t.month}: ${money(t.revenue)}`}
                />
                <span className="text-[11px] text-ink-400">{t.month}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {stats.low_stock > 0 && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <b>{stats.low_stock} product{stats.low_stock === 1 ? '' : 's'}</b> are running low (≤ 3 units).
            {' '}<Link to="/seller/inventory" className="font-bold underline">Manage inventory →</Link>
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================================================ PRODUCTS ============================================================ */
function ProductsPanel() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/seller/products')
      .then((d) => setProducts(d.products))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (p) => {
    setBusyId(p.id);
    try {
      const data = await api.patch(`/api/seller/products/${p.id}/status`, { is_active: !p.is_active });
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_active: data.is_active } : x)));
      toast.success(data.message);
    } catch (err) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setBusyId(p.id);
    try {
      const data = await api.del(`/api/seller/products/${p.id}`);
      toast.success(data.message);
      if (data.removed) setProducts((list) => list.filter((x) => x.id !== p.id));
      else setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_active: false } : x)));
    } catch (err) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  const visible = products.filter((p) =>
    filter === 'all' ? true : filter === 'active' ? p.is_active : !p.is_active);

  if (loading) {
    return (
      <div role="status">
        <div className="skeleton mb-5 h-8 w-56 rounded-lg" />
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          Your products <span className="text-ink-400">({products.length})</span>
        </h1>
        <Link
          to="/seller/products/new"
          className="btn inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
        >
          <PlusCircle className="h-4 w-4" aria-hidden /> Add product
        </Link>
      </div>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filter products">
        {[['all', 'All'], ['active', 'Active'], ['hidden', 'Hidden']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === key ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="seller"
          title={products.length === 0 ? 'No products yet' : `No ${filter} products`}
          description={products.length === 0
            ? 'Create your first listing — it appears in the marketplace the moment you publish it.'
            : 'Switch filters to see your other listings.'}
          actionTo="/seller/products/new"
          actionLabel="Add your first product"
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((p, idx) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-card sm:flex-nowrap sm:gap-4"
              style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
            >
              <Link to={`/product/${p.id}`} className="shrink-0">
                <SafeImage src={p.images?.[0]} alt={p.title} className="h-16 w-16 rounded-xl object-cover" />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/product/${p.id}`} className="line-clamp-1 text-sm font-semibold text-ink-900 hover:text-brand-700">{p.title}</Link>
                  <TypeBadge type={p.product_type} />
                  {!p.is_active && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-500">Hidden</span>}
                </div>
                <p className="mt-0.5 text-xs text-ink-400">
                  {money(p.price)} · {p.is_unlimited ? 'unlimited stock' : `${p.inventory} in stock`} · {p.review_count} review{p.review_count === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleActive(p)}
                  disabled={busyId === p.id}
                  title={p.is_active ? 'Unpublish' : 'Publish'}
                  aria-label={p.is_active ? `Unpublish ${p.title}` : `Publish ${p.title}`}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
                >
                  {busyId === p.id ? <Spinner /> : p.is_active ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
                </button>
                <Link
                  to={`/seller/products/${p.id}`}
                  aria-label={`Edit ${p.title}`}
                  className="btn grid h-9 w-9 place-items-center rounded-full text-ink-400 transition hover:bg-brand-50 hover:text-brand-700"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={busyId === p.id}
                  aria-label={`Delete ${p.title}`}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ PRODUCT FORM ============================================================ */
const EMPTY = {
  title: '', description: '', price: '', category: '', product_type: 'handmade',
  inventory: '10', images: '', location: '', is_featured: false, is_trending: false,
  is_active: true, is_unlimited: false,
};

function ProductForm() {
  const toast = useToast();
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : null;
  const editing = !Number.isNaN(id) && id > 0;

  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/products/meta/categories')
      .then((d) => {
        setCategories(d.categories);
        setForm((f) => (f.category ? f : { ...f, category: d.categories[0]?.slug || '' }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    setLoading(true);
    api.get('/api/seller/products')
      .then((d) => {
        const p = d.products.find((x) => x.id === id);
        if (!p) { setError('Product not found.'); return; }
        setForm({
          title: p.title, description: p.description, price: String(p.price),
          category: p.category, product_type: p.product_type,
          inventory: String(p.inventory), images: (p.images || []).join('\n'),
          location: p.location || '', is_featured: p.is_featured, is_trending: p.is_trending,
          is_active: p.is_active, is_unlimited: p.is_unlimited,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      inventory: parseInt(form.inventory, 10),
      images: form.images,
    };
    setBusy(true);
    try {
      const data = editing
        ? await api.put(`/api/seller/products/${id}`, payload)
        : await api.post('/api/seller/products', payload);
      toast.success(data.message);
      navigate('/seller/products', { replace: true });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader label="Loading product…" />;

  return (
    <div className="animate-fade-up max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink-950">
        {editing ? 'Edit product' : 'Add a new product'}
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {editing ? 'Update your listing — changes appear in the marketplace instantly.'
          : 'Your listing goes live in the marketplace the moment you save it.'}
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-5 rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
        {error && (
          <p role="alert" className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>
        )}

        <div>
          <label htmlFor="p-title" className="text-sm font-semibold text-ink-800">Title *</label>
          <input id="p-title" value={form.title} onChange={set('title')} maxLength={120} required
            placeholder="Hand-thrown ceramic mug" className={inputCls} />
          <p className="mt-1 text-xs text-ink-400">3–120 characters.</p>
        </div>

        <div>
          <label htmlFor="p-desc" className="text-sm font-semibold text-ink-800">Description *</label>
          <textarea id="p-desc" rows={5} value={form.description} onChange={set('description')} required
            placeholder="Tell buyers what makes it special — materials, dimensions, how it's made…" className={areaCls} />
          <p className="mt-1 text-xs text-ink-400">At least 10 characters.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-price" className="text-sm font-semibold text-ink-800">Price (USD) *</label>
            <input id="p-price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required
              placeholder="29.99" className={inputCls} />
          </div>
          <div>
            <label htmlFor="p-category" className="text-sm font-semibold text-ink-800">Category *</label>
            <select id="p-category" value={form.category} onChange={set('category')} className={inputCls}>
              {categories.length === 0 && <option value="">Loading categories…</option>}
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="p-type" className="text-sm font-semibold text-ink-800">Product type *</label>
            <select id="p-type" value={form.product_type} onChange={set('product_type')} className={inputCls}>
              <option value="handmade">Handmade</option>
              <option value="vintage">Vintage</option>
              <option value="digital">Digital</option>
            </select>
          </div>
          <div>
            <label htmlFor="p-inventory" className="text-sm font-semibold text-ink-800">
              {form.product_type === 'digital' || form.is_unlimited ? 'Inventory (downloads are unlimited)' : 'Inventory *'}
            </label>
            <input id="p-inventory" type="number" min="0" value={form.inventory} onChange={set('inventory')}
              disabled={form.product_type === 'digital' || form.is_unlimited} className={`${inputCls} disabled:bg-ink-50 disabled:text-ink-400`} />
          </div>
        </div>

        <div>
          <label htmlFor="p-images" className="text-sm font-semibold text-ink-800">Image URLs</label>
          <textarea id="p-images" rows={3} value={form.images} onChange={set('images')}
            placeholder={'/images/photos/kitchen-dining-0d2uu4c.jpg\n/images/photos/kitchen-dining-0h7git2.jpg\n/images/photos/kitchen-dining-0tnzofh.jpg'} className={areaCls} />
          <p className="mt-1 text-xs text-ink-400">One URL per line (max 6). First image is the thumbnail. Leave blank for the placeholder.</p>
        </div>

        <div>
          <label htmlFor="p-location" className="text-sm font-semibold text-ink-800">Location</label>
          <input id="p-location" value={form.location} onChange={set('location')} placeholder="Portland, Oregon" className={inputCls} />
        </div>

        <fieldset className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wider text-ink-400">Options</legend>
          <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
            <Toggle id="p-unlimited" checked={form.is_unlimited || form.product_type === 'digital'}
              disabled={form.product_type === 'digital'} onChange={set('is_unlimited')}
              label="Unlimited stock (digital)" hint="Never runs out" />
            <Toggle id="p-active" checked={form.is_active} onChange={set('is_active')}
              label="Published" hint="Visible in the marketplace" />
            <Toggle id="p-featured" checked={form.is_featured} onChange={set('is_featured')}
              label="Featured" hint="Show in the home featured row" />
            <Toggle id="p-trending" checked={form.is_trending} onChange={set('is_trending')}
              label="Trending" hint="Show in the trending row" />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
          <button type="button" onClick={() => navigate('/seller/products')} className="text-sm font-semibold text-ink-500 transition hover:text-ink-900">
            Cancel
          </button>
          <Button type="submit" size="lg" loading={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish product'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Toggle({ id, checked, onChange, label, hint, disabled }) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl bg-white p-3 transition ${disabled ? 'opacity-60' : 'hover:bg-ink-50'}`}>
      <input
        id={id} type="checkbox" checked={!!checked} onChange={onChange} disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
      />
      <span>
        <span className="block text-sm font-semibold text-ink-800">{label}</span>
        <span className="block text-xs text-ink-400">{hint}</span>
      </span>
    </label>
  );
}

/* ============================================================ INVENTORY ============================================================ */
function InventoryPanel() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [term, setTerm] = useState('');
  const [values, setValues] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/api/seller/products'),
      api.get('/api/seller/inventory-logs'),
    ])
      .then(([p, l]) => { setProducts(p.products); setLogs(l.logs); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const adjust = async (p, mode) => {
    const raw = values[p.id];
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0) { toast.error('Enter a number of 0 or more.'); return; }
    setBusyId(p.id);
    try {
      const data = await api.patch(`/api/seller/products/${p.id}/inventory`, { mode, value });
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, inventory: data.inventory } : x)));
      setValues((v) => ({ ...v, [p.id]: '' }));
      toast.success(data.message);
      api.get('/api/seller/inventory-logs').then((d) => setLogs(d.logs)).catch(() => {});
    } catch (err) { toast.error(err.message); }
    finally { setBusyId(null); }
  };

  if (loading) {
    return (
      <div role="status">
        <div className="skeleton mb-5 h-8 w-56 rounded-lg" />
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;

  const filtered = products.filter((p) =>
    !term || p.title.toLowerCase().includes(term.toLowerCase()));

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-semibold text-ink-950">Inventory</h1>
      <p className="mt-1 text-sm text-ink-500">Every change is logged and enforced at checkout.</p>

      <div className="relative mt-4">
        <label htmlFor="inv-search" className="sr-only">Search your products</label>
        <input
          id="inv-search" value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Search your products…"
          className="h-11 w-full rounded-full border border-ink-200 bg-ink-50/70 pl-11 pr-4 text-sm transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-400" aria-hidden />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5">
          <EmptyState icon="products" title="No products found" description="Add a product to start tracking stock." actionTo="/seller/products/new" actionLabel="Add product" />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((p) => {
            const low = !p.is_unlimited && p.inventory <= 3;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card sm:flex-nowrap sm:gap-4">
                <SafeImage src={p.images?.[0]} alt={p.title} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-ink-900">{p.title}</p>
                  <p className={`text-xs font-semibold ${low ? 'text-brand-700' : 'text-ink-400'}`}>
                    {p.is_unlimited ? 'Unlimited (digital)' : `${p.inventory} unit${p.inventory === 1 ? '' : 's'} in stock`}
                    {low && !p.is_unlimited && ' — low stock'}
                  </p>
                </div>

                {p.is_unlimited ? (
                  <span className="text-xs font-medium text-evergreen-600">Never runs out</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <label htmlFor={`inv-${p.id}`} className="sr-only">Adjust stock for {p.title}</label>
                    <input
                      id={`inv-${p.id}`} type="number" min="0" placeholder="Qty"
                      value={values[p.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adjust(p, 'add'); } }}
                      className="h-9 w-20 rounded-lg border border-ink-200 px-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button type="button" onClick={() => adjust(p, 'add')} disabled={busyId === p.id}
                      className="rounded-full bg-evergreen-500/10 px-3 py-1.5 text-xs font-bold text-evergreen-600 transition hover:bg-evergreen-500/20 disabled:opacity-50">
                      + Add
                    </button>
                    <button type="button" onClick={() => adjust(p, 'subtract')} disabled={busyId === p.id}
                      className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50">
                      − Remove
                    </button>
                    <button type="button" onClick={() => adjust(p, 'set')} disabled={busyId === p.id}
                      className="rounded-full bg-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 transition hover:bg-ink-200 disabled:opacity-50">
                      Set
                    </button>
                    {busyId === p.id && <Spinner className="text-brand-600" />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* log */}
      <section className="mt-8 rounded-3xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="text-sm font-bold text-ink-800">Recent inventory activity</h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No stock movements yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {logs.slice(0, 12).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-800">{l.title}</p>
                  <p className="text-xs text-ink-400">{l.reason} · {timeAgo(l.created_at)}</p>
                </div>
                <span className={`shrink-0 font-bold ${l.change_amount > 0 ? 'text-evergreen-600' : l.change_amount < 0 ? 'text-red-600' : 'text-ink-400'}`}>
                  {l.change_amount > 0 ? '+' : ''}{l.change_amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============================================================ SELLER ORDERS ============================================================ */
function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/orders/seller/all')
      .then((d) => setOrders(d.orders))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div role="status">
        <div className="skeleton mb-5 h-8 w-56 rounded-lg" />
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalRevenue = orders.reduce((s, o) => s + o.revenue, 0);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">Orders with your items</h1>
          <p className="mt-1 text-sm text-ink-500">{orders.length} order{orders.length === 1 ? '' : 's'} · {money(totalRevenue)} earned</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon="orders"
          title="No orders yet"
          description="When a buyer checks out with your products, the order appears here instantly."
          actionTo="/seller/products"
          actionLabel="Manage products"
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o, idx) => (
            <li key={o.id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-bold text-ink-900">{o.order_number}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                    o.status === 'processing' ? 'bg-brand-100 text-brand-800'
                      : o.status === 'delivered' ? 'bg-evergreen-500/15 text-evergreen-600'
                        : 'bg-ink-100 text-ink-600'}`}>{o.status}</span>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold text-ink-950">{money(o.revenue)}</p>
                  <p className="text-xs text-ink-400">{formatDate(o.created_at)}</p>
                </div>
              </div>

              <ul className="mt-3 space-y-2">
                {o.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 rounded-xl bg-ink-50/70 p-2.5">
                    <SafeImage src={it.image} alt={it.title} className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/product/${it.product_id}`} className="line-clamp-1 text-xs font-semibold text-ink-800 hover:text-brand-700">{it.title}</Link>
                      <p className="text-[11px] text-ink-400">Qty {it.quantity} · {money(it.unit_price)} each</p>
                    </div>
                    <span className="text-xs font-bold text-ink-900">{money(it.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-2.5 text-xs text-ink-400">
                Buyer: <span className="font-medium text-ink-600">{o.customer_name}</span>
                {o.customer_city && <> · {o.customer_city}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ SHOP PROFILE ============================================================ */
function ShopProfile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', username: '', bio: '', avatar: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', username: user.username || '', bio: user.bio || '', avatar: user.avatar || '' });
  }, [user]);
  useEffect(() => {
    api.get('/api/seller/stats').then((d) => setStats(d.stats)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const data = await api.put('/api/profile', { ...form, email: user.email });
      setUser(data.user);
      toast.success('Shop profile updated');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="animate-fade-up max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink-950">Shop profile</h1>
      <p className="mt-1 text-sm text-ink-500">Your public identity as a Craftly seller.</p>

      <div className="mt-5 flex items-center gap-4 rounded-3xl border border-ink-100 bg-white p-5 shadow-card">
        <img
          src={form.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(form.name || user.name)}`}
          alt=""
          className="h-16 w-16 rounded-full border-2 border-brand-100 object-cover"
          onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`; }}
        />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-ink-950">{user.name}’s shop</p>
          <p className="text-sm text-ink-500">
            {stats ? `${stats.active_products} active products · ${stats.orders} orders · ${money(stats.revenue)} earned` : 'Loading shop stats…'}
          </p>
        </div>
        <Link to="/seller/products/new" className="btn ml-auto hidden shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 sm:block">
          Add product
        </Link>
      </div>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4 rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
        {error && <p role="alert" className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
        <div>
          <label htmlFor="sp-name" className="text-sm font-semibold text-ink-800">Shop / owner name</label>
          <input id="sp-name" value={form.name} onChange={set('name')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="sp-username" className="text-sm font-semibold text-ink-800">Username</label>
          <input id="sp-username" value={form.username} onChange={set('username')} className={inputCls} />
        </div>
        <div>
          <label htmlFor="sp-bio" className="text-sm font-semibold text-ink-800">Shop story</label>
          <textarea id="sp-bio" rows={4} maxLength={500} value={form.bio} onChange={set('bio')}
            placeholder="What do you make, and why?" className={areaCls} />
        </div>
        <div>
          <label htmlFor="sp-avatar" className="text-sm font-semibold text-ink-800">Logo URL</label>
          <input id="sp-avatar" type="url" value={form.avatar} onChange={set('avatar')} placeholder="https://…" className={inputCls} />
        </div>
        <Button type="submit" loading={busy}>{busy ? 'Saving…' : 'Save shop profile'}</Button>
      </form>
    </div>
  );
}
