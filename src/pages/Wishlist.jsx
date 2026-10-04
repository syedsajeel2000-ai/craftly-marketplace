/**
 * Wishlist — products the signed-in buyer saved. Backed by the wishlist
 * table in Turso; the ShopContext keeps ids in sync for heart buttons.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/CartContext.jsx';
import { money } from '../lib/api.js';
import { EmptyState, SafeImage, Stars, TypeBadge, Spinner } from '../components/ui.jsx';
import { Reveal } from '../components/motion.jsx';

export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { wishlist, reloadWishlist, removeWishlist, addToCart, adding } = useShop();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    reloadWishlist()
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          icon="wishlist"
          title="Sign in to see your wishlist"
          description="Save the pieces you love and they’ll be waiting here on every visit."
          action={() => navigate('/login', { state: { from: '/wishlist' } })}
          actionLabel="Sign in"
          secondary={<Link to="/register" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Create account</Link>}
        />
      </div>
    );
  }

  const items = wishlist || [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-5 lg:px-8">
      <Reveal className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">
          Your wishlist <span className="text-ink-400">({items.length})</span>
        </h1>
        <p className="mt-1 text-sm text-ink-500">Everything you’ve hearted, saved to your account.</p>
      </Reveal>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4" role="status">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
              <div className="skeleton aspect-square" />
              <div className="space-y-2 p-4"><div className="skeleton h-3.5 w-3/4" /><div className="skeleton h-4 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="wishlist"
          title="Nothing saved yet"
          description="Tap the heart on any product to save it here for later."
          action={() => navigate('/marketplace')}
          actionLabel="Discover products"
          secondary={<Link to="/" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Back home</Link>}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item, idx) => {
            const soldOut = !item.is_unlimited && item.inventory <= 0;
            const busy = adding === item.id;
            return (
              <li
                key={item.id}
                className="group relative flex animate-fade-up flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
              >
                <Link to={`/product/${item.id}`} className="relative block aspect-square overflow-hidden bg-ink-50">
                  <SafeImage src={item.images?.[0]} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                  <span className="absolute left-2.5 top-2.5"><TypeBadge type={item.product_type} /></span>
                  {soldOut && (
                    <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">Sold out</span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
                  <Link to={`/product/${item.id}`} className="line-clamp-2 text-[13px] font-medium leading-snug text-ink-800 hover:text-brand-700 sm:text-sm">
                    {item.title}
                  </Link>
                  <p className="truncate text-xs text-ink-400">by {item.seller_name}</p>
                  <Stars rating={item.rating} count={item.review_count} className="mt-0.5" />

                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className="font-display text-lg font-semibold text-ink-950">{money(item.price)}</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => removeWishlist(item.id)}
                        aria-label={`Remove ${item.title} from wishlist`}
                        className="grid h-9 w-9 place-items-center rounded-full bg-ink-50 text-ink-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={soldOut || busy}
                        onClick={async () => {
                          const res = await addToCart(item.id, 1);
                          if (res.ok) removeWishlist(item.id);
                        }}
                        aria-label={`Move ${item.title} to cart`}
                        className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-600 hover:text-white active:scale-90 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400"
                      >
                        {busy ? <Spinner /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  </div>
                  {!item.in_stock && !soldOut && <p className="text-xs font-semibold text-brand-700">Restocking soon</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <div className="mt-8 text-center">
          <Link to="/marketplace" className="btn inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">
            <Heart className="h-4 w-4" aria-hidden /> Find more to love
          </Link>
        </div>
      )}
    </div>
  );
}
