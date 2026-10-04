/**
 * Order history — every order the signed-in buyer has placed.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ArrowRight, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, money, formatDate } from '../lib/api.js';
import { EmptyState, ErrorState, LineSkeleton, SafeImage, PageLoader } from '../components/ui.jsx';

export const STATUS_STYLE = {
  processing: 'bg-brand-100 text-brand-800',
  shipped: 'bg-sky-100 text-sky-800',
  delivered: 'bg-evergreen-500/15 text-evergreen-600',
  cancelled: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[status] || 'bg-ink-100 text-ink-600'}`}>
      {status}
    </span>
  );
}

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get('/api/orders')
      .then((d) => setOrders(d.orders))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return <PageLoader label="Loading your orders…" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          icon="orders"
          title="Sign in to view your orders"
          description="Your purchase history lives in your account — securely stored, never in your browser."
          action={() => navigate('/login', { state: { from: '/orders' } })}
          actionLabel="Sign in"
          secondary={<Link to="/register" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Create account</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">Your orders</h1>
        <p className="mt-1 text-sm text-ink-500">Track deliveries, review purchases and reorder favourites.</p>
      </div>

      {loading ? (
        <div className="space-y-3" role="status">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-ink-100 bg-white p-5">
              <LineSkeleton className="mb-3 w-1/3" />
              <div className="flex gap-3">
                <div className="skeleton h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2"><LineSkeleton className="w-2/3" /><LineSkeleton className="w-1/4" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="orders"
          title="No orders yet"
          description="When you place your first order, it will appear here with live status updates."
          action={() => navigate('/marketplace')}
          actionLabel="Start shopping"
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order, idx) => {
            const items = order.items || [];
            const preview = items.slice(0, 3);
            return (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}`}
                  className="group flex animate-fade-up flex-col gap-4 rounded-3xl border border-ink-100 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm font-bold text-ink-900">{order.order_number}</span>
                      <StatusBadge status={order.status} />
                      <span className="rounded-full bg-ink-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-ink-500">
                        {order.payment_status}
                      </span>
                    </div>
                    <span className="text-xs text-ink-400">{formatDate(order.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {preview.map((item) => (
                        <SafeImage
                          key={item.id}
                          src={item.image}
                          alt={item.title}
                          className="h-14 w-14 rounded-xl border-2 border-white object-cover shadow-sm"
                        />
                      ))}
                      {items.length > 3 && (
                        <span className="grid h-14 w-14 place-items-center rounded-xl border-2 border-white bg-ink-100 text-xs font-bold text-ink-500">
                          +{items.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-ink-800">
                        {items.map((i) => i.title).join(', ')}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {items.reduce((s, i) => s + i.quantity, 0)} item{items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-semibold text-ink-950">{money(order.total_amount)}</span>
                      <ChevronRight className="h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
