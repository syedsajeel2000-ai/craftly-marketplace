/** Product detail — gallery, buy box, reviews, review form, related products. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Heart, ShoppingBag, Minus, Plus, Store, ShieldCheck, Truck, Download,
  ChevronRight, BadgeCheck, Share2, ArrowLeft,
} from 'lucide-react';
import { api, money, formatDate } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import {
  SafeImage, Stars, TypeBadge, StockBadge, ErrorState, PageLoader,
  Button, Spinner, EmptyState,
} from '../components/ui.jsx';
import { Reveal } from '../components/motion.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, toggleWishlist, wishlistIds, adding } = useShop();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [addingNow, setAddingNow] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/products/${id}`);
      setProduct(data.product);
      setActiveImg(0);
      setQty(1);
    } catch (err) {
      setError(err.message);
      if (err.status === 404) setError('This product doesn’t exist or is no longer available.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  // reset review form errors when product changes
  useEffect(() => { setReviewError(null); setReviewForm({ rating: 5, text: '' }); }, [id]);

  if (loading) return <div className="mx-auto max-w-[1400px] px-5 py-10"><PageLoader label="Loading product…" /></div>;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <ErrorState message={error} onRetry={error.includes('exist') ? null : load} />
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>← Go back</Button>
          <Link to="/marketplace" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Continue shopping</Link>
        </div>
      </div>
    );
  }

  const p = product;
  const images = p.images?.length ? p.images : ['/images/placeholder.svg'];
  const wished = wishlistIds.has(p.id);
  const soldOut = !p.is_unlimited && p.inventory <= 0;
  const maxQty = p.is_unlimited ? 10 : Math.min(p.inventory, 10);
  const isAdding = adding === p.id;

  const handleCart = async (openCart = false) => {
    if (!user) { navigate('/login', { state: { from: `/product/${p.id}` } }); return; }
    setAddingNow(true);
    const res = await addToCart(p.id, qty);
    setAddingNow(false);
    if (res.ok && openCart) navigate('/cart');
  };

  const handleWish = async () => {
    if (!user) { navigate('/login', { state: { from: `/product/${p.id}` } }); return; }
    await toggleWishlist(p.id);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login', { state: { from: `/product/${p.id}` } }); return; }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const data = await api.post(`/api/products/${p.id}/reviews`, {
        rating: reviewForm.rating, review_text: reviewForm.text,
      });
      toast.success(data.message);
      setReviewForm({ rating: 5, text: '' });
      await load(); // refresh rating/review list from DB
    } catch (err) {
      setReviewError(err.message);
      toast.error(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied to clipboard'); }
    } catch { /* user dismissed */ }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
        <button type="button" onClick={() => navigate('/')} className="hover:text-brand-700">Home</button>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link to="/marketplace" className="hover:text-brand-700">Marketplace</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link to={`/category/${p.category}`} className="capitalize hover:text-brand-700">{p.category.replace(/-/g, ' ')}</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="line-clamp-1 text-ink-600">{p.title}</span>
      </nav>

      <div className="grid gap-7 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        {/* ---------------- gallery ---------------- */}
        <div className="animate-fade-up">
          <div className="relative overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card">
            <SafeImage
              key={activeImg}
              src={images[activeImg]}
              alt={`${p.title} — image ${activeImg + 1} of ${images.length}`}
              className="aspect-square w-full animate-fade-in object-cover"
            />
            <button
              type="button"
              onClick={share}
              aria-label="Share this product"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink-600 shadow-sm backdrop-blur transition hover:bg-white active:scale-90"
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Product images">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  role="tab"
                  aria-selected={activeImg === i}
                  aria-label={`Show image ${i + 1}`}
                  onClick={() => setActiveImg(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-20 ${activeImg === i ? 'border-brand-500 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <SafeImage src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- buy box ---------------- */}
        <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={p.product_type} />
            {p.is_featured && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">Featured</span>}
            {p.is_trending && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">Trending</span>}
          </div>

          <h1 className="mt-2.5 font-display text-2xl font-semibold leading-tight text-ink-950 sm:text-3xl">{p.title}</h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm">
            <Stars rating={p.rating} count={p.review_count} size="lg" />
            <span className="text-ink-300">·</span>
            <Link to={`/shop/${p.seller_username}`} className="flex items-center gap-1 font-medium text-ink-600 underline-offset-2 transition hover:text-brand-700 hover:underline">
              <Store className="h-4 w-4" aria-hidden /> {p.seller_name}
            </Link>
            {p.location && <span className="text-ink-400">· {p.location}</span>}
          </div>

          <div className="mt-5 flex items-end gap-3">
            <p className="font-display text-4xl font-semibold text-ink-950">{money(p.price)}</p>
            {p.price >= 50 && <span className="mb-1.5 text-xs font-semibold text-evergreen-600">Free shipping</span>}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <StockBadge product={p} />
            <span className="text-xs text-ink-400">· {p.category.replace(/-/g, ' ')}</span>
          </div>

          <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{p.description}</p>

          {/* qty + actions */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3">
              <span id="qty-label" className="text-sm font-semibold text-ink-800">Quantity</span>
              <div className="flex items-center rounded-full border border-ink-200 bg-white">
                <button
                  type="button" onClick={() => setQty((v) => Math.max(1, v - 1))}
                  disabled={qty <= 1} aria-label="Decrease quantity"
                  className="grid h-10 w-10 place-items-center rounded-l-full text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
                ><Minus className="h-4 w-4" aria-hidden /></button>
                <span aria-live="polite" className="w-10 text-center text-sm font-bold text-ink-900">{qty}</span>
                <button
                  type="button" onClick={() => setQty((v) => Math.min(maxQty, v + 1))}
                  disabled={qty >= maxQty} aria-label="Increase quantity"
                  className="grid h-10 w-10 place-items-center rounded-r-full text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
                ><Plus className="h-4 w-4" aria-hidden /></button>
              </div>
              {!p.is_unlimited && p.inventory > 0 && p.inventory <= 10 && (
                <span className="text-xs text-ink-500">Max {p.inventory} available</span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                onClick={() => handleCart(false)}
                disabled={soldOut || isAdding || addingNow}
                size="lg"
                className="flex-1"
              >
                {(isAdding || addingNow) ? <Spinner /> : <ShoppingBag className="h-4.5 w-4.5" aria-hidden />}
                {soldOut ? 'Sold out' : 'Add to cart'}
              </Button>
              <Button
                variant="dark"
                onClick={() => handleCart(true)}
                disabled={soldOut || isAdding || addingNow}
                size="lg"
                className="flex-1"
              >
                Buy it now
              </Button>
              <button
                type="button" onClick={handleWish} aria-pressed={wished}
                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink-200 bg-white transition hover:border-brand-300 hover:bg-brand-50 active:scale-90"
              >
                <Heart className={`h-5 w-5 ${wished ? 'animate-heart-pop fill-brand-600 text-brand-600' : 'text-ink-500'}`} aria-hidden />
              </button>
            </div>
          </div>

          {/* trust badges */}
          <ul className="mt-6 grid gap-2.5 rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600 sm:grid-cols-2">
            {[
              [Truck, p.product_type === 'digital' ? 'Instant download' : 'Ships in 1–3 business days'],
              [ShieldCheck, 'Secure demo checkout'],
              [Download, p.is_unlimited ? 'Unlimited digital licence' : 'Carefully packaged'],
              [BadgeCheck, `Sold by ${p.seller_name}`],
            ].map(([Icon, text], i) => (
              <li key={i} className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---------------- reviews ---------------- */}
      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_360px]" aria-labelledby="reviews-heading">
        <Reveal>
          <div className="mb-5 flex items-center justify-between">
            <h2 id="reviews-heading" className="font-display text-xl font-semibold text-ink-950 sm:text-2xl">
              Reviews ({p.review_count})
            </h2>
            <div className="flex items-center gap-2">
              <Stars rating={p.rating} size="lg" />
              <span className="text-sm font-semibold text-ink-700">{Number(p.rating).toFixed(1)}/5</span>
            </div>
          </div>

          {p.reviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">
              No reviews yet — be the first to review this product after you buy it.
            </p>
          ) : (
            <ul className="space-y-4">
              {p.reviews.map((r) => (
                <li key={r.id} className="animate-fade-up rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                  <div className="flex items-start gap-3">
                    <SafeImage src={r.reviewer_avatar} alt="" className="h-9 w-9 shrink-0 rounded-full bg-ink-100 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-900">{r.reviewer_name}</p>
                        <span className="text-xs text-ink-400">{formatDate(r.created_at)}</span>
                      </div>
                      <Stars rating={r.rating} className="mt-1" />
                      <p className="mt-2 text-sm leading-relaxed text-ink-600">{r.review_text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        {/* review form */}
        <div className="lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card">
            <h3 className="font-display text-lg font-semibold text-ink-950">Write a review</h3>
            {p.purchased ? (
              <form onSubmit={submitReview} className="mt-4 space-y-4">
                <div>
                  <span className="text-sm font-semibold text-ink-800" id="rating-label">Your rating</span>
                  <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-labelledby="rating-label">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n} type="button" role="radio" aria-checked={reviewForm.rating === n}
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                        className={`grid h-10 w-10 place-items-center rounded-xl border text-sm font-bold transition ${reviewForm.rating === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-400 hover:border-ink-300'}`}
                      >
                        {n}★
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="review-text" className="text-sm font-semibold text-ink-800">Your review</label>
                  <textarea
                    id="review-text" required minLength={5} rows={4}
                    value={reviewForm.text}
                    onChange={(e) => setReviewForm((f) => ({ ...f, text: e.target.value }))}
                    placeholder="What did you love about it?"
                    className="mt-1.5 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                </div>
                {reviewError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{reviewError}</p>}
                <Button type="submit" loading={submittingReview} className="w-full">Post review</Button>
              </form>
            ) : user ? (
              <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
                <p className="font-medium text-ink-800">Only verified buyers can review.</p>
                <p className="mt-1 text-xs text-ink-500">Purchase this product and your review form will appear here.</p>
                {!soldOut && <Button size="sm" variant="outline" className="mt-3" onClick={() => handleCart(false)}>Add to cart</Button>}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
                <p className="font-medium text-ink-800">Sign in to review your purchases.</p>
                <Link to="/login" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Sign in →</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- related ---------------- */}
      {p.related?.length > 0 && (
        <Reveal as="section" className="mt-14" amount={0.05} aria-labelledby="related-heading">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Keep exploring</p>
              <h2 id="related-heading" className="mt-1 font-display text-xl font-semibold text-ink-950 sm:text-2xl">You may also like</h2>
            </div>
            <Link to={`/category/${p.category}`} className="text-sm font-semibold text-brand-700 hover:underline">More in {p.category.replace(/-/g, ' ')} →</Link>
          </div>
          <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {p.related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </Reveal>
      )}

      {/* mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-ink-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold text-ink-950">{money(p.price)}</p>
          <p className="truncate text-xs text-ink-500">{soldOut ? 'Sold out' : `${p.title.slice(0, 34)}${p.title.length > 34 ? '…' : ''}`}</p>
        </div>
        <Button onClick={() => handleCart(false)} disabled={soldOut || isAdding || addingNow} className="shrink-0">
          {isAdding ? <Spinner /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
          {soldOut ? 'Sold out' : 'Add to cart'}
        </Button>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  );
}
