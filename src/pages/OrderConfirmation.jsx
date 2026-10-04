/**
 * Order confirmation — shown right after a successful checkout.
 * The order object comes from navigation state, falling back to a fresh
 * fetch from /api/orders/:id (so a refresh still renders correctly).
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Package, Truck, Download, ArrowRight } from 'lucide-react';
import { api, money, formatDate } from '../lib/api.js';
import { Button, EmptyState, ErrorState, LineSkeleton, SafeImage, Spinner } from '../components/ui.jsx';

export default function OrderConfirmation() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (order) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/api/orders/${id}`)
      .then((d) => { if (!cancelled) setOrder(d.order); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14" role="status">
        <div className="skeleton mx-auto mb-6 h-20 w-20 rounded-full" />
        <div className="skeleton mb-3 h-8 w-2/3 rounded-lg" />
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <ErrorState message={error || 'Order not found.'} onRetry={() => navigate('/orders')} />
        <div className="mt-4 text-center">
          <Link to="/orders" className="text-sm font-semibold text-brand-700 hover:underline">View your orders</Link>
        </div>
      </div>
    );
  }

  const items = order.items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const shippingCost = Math.max(0, Math.round((Number(order.total_amount) - subtotal) * 100) / 100);
  const isDigital = items.length > 0 && items.every((i) => i.is_digital);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5">
      <div className="animate-fade-up overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card">
        {/* success header */}
        <div className="border-b border-ink-100 bg-gradient-to-br from-evergreen-500/10 via-white to-brand-50/70 px-6 py-9 text-center sm:px-10">
          <span className="mx-auto grid h-20 w-20 animate-scale-in place-items-center rounded-full bg-evergreen-500 text-white shadow-lg shadow-evergreen-500/25">
            <Check className="h-10 w-10" strokeWidth={3} aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink-950 sm:text-3xl">
            Thank you — your order is confirmed!
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-500">
            We sent a receipt to <span className="font-semibold text-ink-800">{order.shipping?.email}</span>.
            Sellers are notified immediately and start preparing your items.
          </p>
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-900 shadow-sm ring-1 ring-ink-100">
              Order {order.order_number}
            </span>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-500 shadow-sm ring-1 ring-ink-100">
              {formatDate(order.created_at)}
            </span>
            <span className="rounded-full bg-evergreen-500/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-evergreen-600">
              {order.payment_status === 'paid' ? 'Paid (demo)' : order.payment_status}
            </span>
          </div>
        </div>

        <div className="px-5 py-7 sm:px-8">
          {/* items */}
          <h2 className="font-display text-lg font-semibold text-ink-950">Your items</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-ink-50/50 p-3">
                <SafeImage src={item.image} alt={item.title} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${item.product_id}`} className="line-clamp-1 text-sm font-medium text-ink-900 hover:text-brand-700">
                    {item.title}
                  </Link>
                  <p className="text-xs text-ink-400">Qty {item.quantity} · {money(item.unit_price)} each</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink-900">{money(item.subtotal)}</span>
              </li>
            ))}
          </ul>

          {/* totals */}
          <dl className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="font-semibold text-ink-900">{money(subtotal)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Shipping</dt>
              <dd className="font-semibold text-ink-900">{shippingCost === 0 ? <span className="text-evergreen-600">Free</span> : money(shippingCost)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-3">
              <dt className="font-semibold text-ink-900">Total paid</dt>
              <dd className="font-display text-2xl font-semibold text-ink-950">{money(order.total_amount)}</dd>
            </div>
          </dl>

          {/* shipping / delivery */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
                {isDigital ? <Download className="h-4 w-4" aria-hidden /> : <Truck className="h-4 w-4" aria-hidden />}
                {isDigital ? 'Delivery' : 'Shipping to'}
              </p>
              {isDigital ? (
                <p className="mt-2 text-sm text-ink-600">Your digital items are available instantly — open your order any time to access them.</p>
              ) : (
                <address className="mt-2 not-italic text-sm leading-relaxed text-ink-700">
                  {order.shipping?.name}<br />
                  {order.shipping?.address}<br />
                  {order.shipping?.city}{order.shipping?.state ? `, ${order.shipping.state}` : ''} {order.shipping?.postal}<br />
                  {order.shipping?.country}
                </address>
              )}
            </div>
            <div className="rounded-2xl border border-ink-100 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
                <Package className="h-4 w-4" aria-hidden /> What happens next
              </p>
              <ol className="mt-2 space-y-1.5 text-sm text-ink-600">
                <li>1. Sellers review and accept your order</li>
                <li>2. Items are packed / files prepared</li>
                <li>3. You can track status under Orders</li>
              </ol>
            </div>
          </div>

          {/* actions */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to={`/orders/${order.id}`}
              className="btn inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-700 active:scale-[0.97]"
            >
              View order details <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/marketplace"
              className="btn inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-800 transition hover:bg-ink-50 active:scale-[0.97]"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
