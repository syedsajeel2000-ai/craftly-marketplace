/** Shopping cart — quantity controls, server-computed totals, issues banner. */
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ArrowRight, ShieldCheck, AlertTriangle, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/CartContext.jsx';
import { money } from '../lib/api.js';
import { Button, EmptyState, LineSkeleton, Spinner, SafeImage, TypeBadge } from '../components/ui.jsx';
import { Reveal, Stagger, StaggerItem } from '../components/motion.jsx';

export default function Cart() {
  const { user, loading: authLoading } = useAuth();
  const { cart, cartLoading, setQuantity, removeFromCart, clearCart, reloadCart } = useShop();
  const navigate = useNavigate();

  if (authLoading || (!user && !authLoading)) {
    if (!user && !authLoading) {
      return (
        <div className="mx-auto max-w-3xl px-5 py-16">
          <EmptyState
            icon="cart"
            title="Sign in to see your cart"
            description="Your cart is saved to your account so it’s waiting for you on any device."
            action={() => navigate('/login', { state: { from: '/cart' } })}
            actionLabel="Sign in"
            secondary={<Link to="/register" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Create account</Link>}
          />
        </div>
      );
    }
  }

  const items = cart.items || [];
  const busyId = null;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-5 lg:px-8">
      <Reveal className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">
          Your cart {items.length > 0 && <span className="text-ink-400">({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})</span>}
        </h1>
        {items.length > 0 && (
          <button type="button" onClick={clearCart} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 transition hover:text-red-700">
            <Trash2 className="h-4 w-4" aria-hidden /> Clear cart
          </button>
        )}
      </Reveal>

      {cartLoading && items.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-4">
                <div className="skeleton h-20 w-20 rounded-xl" />
                <div className="flex-1 space-y-2"><LineSkeleton className="w-2/3" /><LineSkeleton className="w-1/3" /></div>
              </div>
            ))}
          </div>
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="cart"
          title="Your cart is empty."
          description="Browse the marketplace and add something you love — we’ll keep it safe in your account."
          action={() => navigate('/marketplace')}
          actionLabel="Continue shopping"
          secondary={<Link to="/wishlist" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">View wishlist</Link>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ---------------- items ---------------- */}
          <Stagger className="space-y-3" amount={0.05}>
            {cart.has_issues && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Some items need attention before checkout.</p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {items.filter((i) => i.issues?.length).map((i) => (
                      <li key={i.product_id}>{i.title}: {i.issues.join(', ')}</li>
                    ))}
                  </ul>
                  <button type="button" onClick={reloadCart} className="mt-1.5 text-xs font-bold underline">Refresh cart</button>
                </div>
              </div>
            )}

            {items.map((item) => {
              const lineBlocked = item.issues?.length > 0;
              return (
                <StaggerItem
                  key={item.product_id}
                  className="flex gap-3 rounded-2xl border border-ink-100 bg-white p-3.5 shadow-card sm:gap-4 sm:p-4"
                >
                  <Link to={`/product/${item.product_id}`} className="shrink-0">
                    <SafeImage src={item.image} alt={item.title} className="h-20 w-20 rounded-xl object-cover transition sm:h-24 sm:w-24" />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/product/${item.product_id}`} className="line-clamp-2 text-sm font-medium text-ink-900 hover:text-brand-700">
                          {item.title}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-ink-400">by {item.seller_name}</p>
                        <div className="mt-1"><TypeBadge type={item.product_type} /></div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product_id)}
                        aria-label={`Remove ${item.title} from cart`}
                        className="rounded-full p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    {lineBlocked && <p className="mt-1 text-xs font-semibold text-red-600">{item.issues.join(' · ')}</p>}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2.5">
                      <div className="flex items-center rounded-full border border-ink-200">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.product_id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={`Decrease quantity of ${item.title}`}
                          className="grid h-9 w-9 place-items-center rounded-l-full text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
                        ><Minus className="h-3.5 w-3.5" aria-hidden /></button>
                        <span aria-live="polite" className="w-9 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                          disabled={!item.is_unlimited && item.quantity >= item.inventory}
                          aria-label={`Increase quantity of ${item.title}`}
                          className="grid h-9 w-9 place-items-center rounded-r-full text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
                        ><Plus className="h-3.5 w-3.5" aria-hidden /></button>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-ink-400">{money(item.price)} each</p>
                        <p className="font-display text-lg font-semibold text-ink-950">{money(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}

            <Link to="/marketplace" className="inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brand-700 hover:underline">
              ← Continue shopping
            </Link>
          </Stagger>

          {/* ---------------- summary ---------------- */}
          <aside className="lg:sticky lg:top-40 lg:self-start">
            <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card">
              <h2 className="font-display text-lg font-semibold text-ink-950">Order summary</h2>

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="font-semibold text-ink-900">{money(cart.subtotal)}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Shipping</dt>
                  <dd className="font-semibold text-ink-900">{cart.shipping === 0 ? <span className="text-evergreen-600">Free</span> : money(cart.shipping)}</dd>
                </div>
                {cart.hasDigital && !cart.hasPhysical && (
                  <div className="flex justify-between"><dt className="text-ink-500">Delivery</dt><dd className="text-xs font-medium text-evergreen-600">Instant download</dd></div>
                )}
                <div className="mt-3 flex justify-between border-t border-ink-100 pt-3">
                  <dt className="font-semibold text-ink-900">Total</dt>
                  <dd className="font-display text-2xl font-semibold text-ink-950">{money(cart.total)}</dd>
                </div>
              </dl>

              <Button
                size="lg"
                className="mt-5 w-full"
                disabled={cart.has_issues}
                onClick={() => navigate('/checkout')}
              >
                Proceed to checkout <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>

              {cart.has_issues && (
                <p className="mt-2 text-center text-xs font-medium text-amber-700">Resolve cart issues to continue.</p>
              )}

              <ul className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden /> Secure demo payment — no real money charged</li>
                <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-brand-600" aria-hidden /> Cart saved to your account, not your browser</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
