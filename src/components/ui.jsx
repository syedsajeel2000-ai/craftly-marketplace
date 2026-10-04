/** Shared UI primitives: ratings, skeletons, empty states, safe images, badges. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, PackageSearch, Inbox, Heart, ShoppingBag, SearchX, Store, Package } from 'lucide-react';

export const TYPE_LABEL = { handmade: 'Handmade', vintage: 'Vintage', digital: 'Digital' };
export const TYPE_STYLE = {
  handmade: 'bg-brand-100 text-brand-800',
  vintage: 'bg-violet-100 text-violet-800',
  digital: 'bg-sky-100 text-sky-800',
};

export function Stars({ rating = 0, count, size = 'sm', className = '' }) {
  const px = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const rounded = Math.round((Number(rating) || 0) * 2) / 2;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
        return (
          <span key={i} className="relative inline-block">
            <Star className={`${px} text-ink-200`} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${px} fill-amber-400 text-amber-400`} aria-hidden />
            </span>
          </span>
        );
      })}
      {count !== undefined && (
        <span className={`ml-1 ${size === 'lg' ? 'text-sm' : 'text-xs'} text-ink-500`}>
          {Number(rating || 0).toFixed(1)}{count !== null && ` (${count})`}
        </span>
      )}
    </span>
  );
}

export function TypeBadge({ type, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${TYPE_STYLE[type] || 'bg-ink-100 text-ink-700'} ${className}`}>
      {TYPE_LABEL[type] || type}
    </span>
  );
}

export function StockBadge({ product }) {
  if (product.is_unlimited) return <span className="text-xs font-medium text-evergreen-600">Unlimited · Instant download</span>;
  if (product.inventory <= 0) return <span className="text-xs font-semibold text-red-600">Sold out</span>;
  if (product.inventory <= 3) return <span className="text-xs font-semibold text-brand-700">Only {product.inventory} left</span>;
  return <span className="text-xs font-medium text-evergreen-600">In stock</span>;
}

/** Image with graceful fallback (never shows a broken image icon). */
export function SafeImage({ src, alt, className = '', ...rest }) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <img
      src={show ? src : '/images/placeholder.svg'}
      alt={alt || ''}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}

// ---------------- Skeletons ----------------
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
      <div className="skeleton aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3.5">
        <div className="skeleton h-3.5 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-4 w-1/3" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}

export function LineSkeleton({ className = '' }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" role="status">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink-200 border-t-brand-600" />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}

// ---------------- Empty states ----------------
const EMPTY_ICONS = {
  products: PackageSearch,
  search: SearchX,
  cart: ShoppingBag,
  wishlist: Heart,
  orders: Package,
  seller: Store,
  inbox: Inbox,
};

export function EmptyState({ icon = 'products', title, description, action, actionTo, actionLabel, secondary }) {
  const Icon = EMPTY_ICONS[icon] || PackageSearch;
  return (
    <div className="mx-auto flex max-w-md animate-fade-up flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-white/70 px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</p>}
      {(action || secondary) && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {action && (actionTo ? (
            <Link to={actionTo} className="btn rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700 active:scale-95">
              {actionLabel || action}
            </Link>
          ) : (
            <button type="button" onClick={action} className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700 active:scale-95">
              {actionLabel}
            </button>
          ))}
          {secondary}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="mx-auto flex max-w-md animate-fade-up flex-col items-center rounded-3xl border border-red-100 bg-red-50/60 px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-red-500 shadow-sm">!</div>
      <p className="text-sm font-medium text-ink-800">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-5 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700">
          Try again
        </button>
      )}
    </div>
  );
}

// ---------------- Buttons ----------------
export function Spinner({ className = '' }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', ...rest }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    dark: 'bg-ink-900 text-white hover:bg-ink-700',
    outline: 'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
    ghost: 'text-ink-600 hover:bg-ink-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-[15px]',
  };
  return (
    <button
      type="button"
      disabled={loading || rest.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
