/** Product card used across home, marketplace, wishlist and related grids. */
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/CartContext.jsx';
import { money } from '../lib/api.js';
import { SafeImage, Stars, TypeBadge } from './ui.jsx';

export default function ProductCard({ product, onRemoved }) {
  const { user } = useAuth();
  const { addToCart, toggleWishlist, wishlistIds, adding } = useShop();
  const navigate = useNavigate();

  const wished = wishlistIds.has(product.id);
  const loading = adding === product.id;
  const soldOut = !product.is_unlimited && product.inventory <= 0;

  const handleWish = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: `/product/${product.id}` } });
      return;
    }
    const res = await toggleWishlist(product.id);
    if (res.ok && !res.wishlisted && onRemoved) onRemoved(product.id);
  };

  const handleCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: `/product/${product.id}` } });
      return;
    }
    await addToCart(product.id, 1);
  };

  return (
    <motion.article
      initial={false}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-shadow duration-300 hover:shadow-card-hover"
    >
      <Link
        to={`/product/${product.id}`}
        className="relative block aspect-square overflow-hidden bg-ink-50"
        aria-label={`View ${product.title}`}
      >
        <SafeImage
          src={product.images?.[0]}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
        {/* Badges stack in the top-left; the top-right corner belongs to the
            wishlist button, so nothing overlaps or gets clipped. */}
        <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          <TypeBadge type={product.product_type} />
          {product.is_featured && (
            <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950 shadow-sm">
              Featured
            </span>
          )}
        </span>
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">
            Sold out
          </span>
        )}
      </Link>

      <button
        type="button"
        onClick={handleWish}
        aria-label={wished ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
        aria-pressed={wished}
        className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white active:scale-90 sm:right-2.5 sm:top-2.5"
      >
        <Heart
          className={`h-[18px] w-[18px] transition-all ${wished ? 'animate-heart-pop fill-brand-600 text-brand-600' : 'text-ink-500 group-hover:text-ink-700'}`}
          aria-hidden
        />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <Link to={`/product/${product.id}`} className="line-clamp-2 text-[13px] font-medium leading-snug text-ink-800 transition hover:text-brand-700 sm:text-sm">
          {product.title}
        </Link>

        <p className="truncate text-xs text-ink-400">
          by{' '}
          {product.seller_username ? (
            <Link
              to={`/shop/${product.seller_username}`}
              className="font-medium text-ink-500 underline-offset-2 transition hover:text-brand-700 hover:underline"
            >
              {product.seller_name}
            </Link>
          ) : (
            <span className="font-medium text-ink-500">{product.seller_name}</span>
          )}
        </p>

        <div className="mt-0.5 flex items-center gap-2">
          <Stars rating={product.rating} count={product.review_count} />
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="font-display text-lg font-semibold text-ink-950">{money(product.price)}</p>
            {product.category && (
              <Link to={`/category/${product.category}`} className="text-[11px] capitalize text-ink-400 underline-offset-2 hover:text-brand-700 hover:underline">
                {product.category.replace(/-/g, ' ')}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={handleCart}
            disabled={soldOut || loading}
            aria-label={`Add ${product.title} to cart`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-600 hover:text-white active:scale-90 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400"
          >
            {loading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              : <ShoppingBag className="h-[17px] w-[17px]" aria-hidden />}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/** Compact confirmation strip used inside product detail / cart feedback. */
export function AddedCheck() {
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-evergreen-600"><Check className="h-3.5 w-3.5" /> Added</span>;
}
