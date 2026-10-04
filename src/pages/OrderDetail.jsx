/**
 * Order detail — full breakdown of one order (items, address, payment, totals).
 * Only the owner can read it (the API enforces ownership).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CreditCard, MapPin, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, money, formatDate } from '../lib/api.js';
import { EmptyState, ErrorState, LineSkeleton, SafeImage, PageLoader } from '../components/ui.jsx';
import { StatusBadge } from './Orders.jsx';

function Card({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-6 ${className}`}>
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
        {Icon && <Icon className="h-4 w-4" aria-hidden />} {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get(`/api/orders/${id}`)
      .then((d) => setOrder(d.order))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (user) load(); }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return <PageLoader label="Loading order…" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          icon="orders"
          title="Sign in to view this order"
          description="Orders are private to your account."
          action={() => navigate('/login', { state: { from: `/orders/${id}` } })}
          actionLabel="Sign in"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-8" role="status">
        <div className="skeleton mb-4 h-7 w-64 rounded-lg" />
        <div className="space-y-4">
          <div className="skeleton h-40 rounded-3xl" />
          <div className="skeleton h-56 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14">
        <ErrorState message={error || 'Order not found.'} onRetry={load} />
        <div className="mt-4 text-center">
          <Link to="/orders" className="text-sm font-semibold text-brand-700 hover:underline">← Back to your orders</Link>
        </div>
      </div>
    );
  }

  const items = order.items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const shippingCost = Math.max(0, Math.round((Number(order.total_amount) - subtotal) * 100) / 100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 lg:px-8">
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">{order.order_number}</h1>
          <p className="mt-1 text-sm text-ink-500">Placed on {formatDate(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <span className="rounded-full bg-evergreen-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-evergreen-600">
            {order.payment_status === 'paid' ? 'Paid (demo)' : order.payment_status}
          </span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card title="Shipping address" icon={MapPin} className="animate-fade-up">
          <address className="not-italic text-sm leading-relaxed text-ink-700">
            <span className="font-semibold text-ink-900">{order.shipping?.name}</span><br />
            {order.shipping?.address}<br />
            {order.shipping?.city}{order.shipping?.state ? `, ${order.shipping.state}` : ''} {order.shipping?.postal}<br />
            {order.shipping?.country}
          </address>
          <p className="mt-3 text-xs text-ink-400">{order.shipping?.email} · {order.shipping?.phone}</p>
        </Card>

        <Card title="Payment" icon={CreditCard} className="animate-fade-up" >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Method</dt><dd className="font-semibold capitalize text-ink-900">{String(order.payment_method || 'demo').replace('_', ' ')}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Status</dt><dd className="font-semibold text-evergreen-600">{order.payment_status}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="font-semibold text-ink-900">{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Shipping</dt><dd className="font-semibold text-ink-900">{shippingCost === 0 ? 'Free' : money(shippingCost)}</dd></div>
            <div className="flex justify-between border-t border-ink-100 pt-2">
              <dt className="font-semibold text-ink-900">Total</dt>
              <dd className="font-display text-xl font-semibold text-ink-950">{money(order.total_amount)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <section className="mt-5 rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-6 animate-fade-up">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
          <Package className="h-4 w-4" aria-hidden /> Items ({items.length})
        </h2>
        <ul className="mt-4 divide-y divide-ink-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
              <SafeImage src={item.image} alt={item.title} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <Link to={`/product/${item.product_id}`} className="line-clamp-1 text-sm font-medium text-ink-900 hover:text-brand-700">
                  {item.title}
                </Link>
                <p className="mt-0.5 text-xs text-ink-400">Qty {item.quantity} · {money(item.unit_price)} each</p>
                <Link
                  to={`/product/${item.product_id}#reviews`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  <MessageSquare className="h-3 w-3" aria-hidden /> Leave a review
                </Link>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink-900">{money(item.subtotal)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-ink-100 bg-ink-50/60 px-5 py-4 text-sm text-ink-500">
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-brand-600" aria-hidden />
          {order.status === 'processing' && 'Your order is being prepared by the sellers.'}
          {order.status === 'shipped' && 'Your order is on its way!'}
          {order.status === 'delivered' && 'Delivered — we hope you love it.'}
          {order.status === 'cancelled' && 'This order was cancelled.'}
        </span>
        <Link to="/marketplace" className="font-semibold text-brand-700 hover:underline">Continue shopping →</Link>
      </div>
    </div>
  );
}
