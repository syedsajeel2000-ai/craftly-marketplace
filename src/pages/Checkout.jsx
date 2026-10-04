/**
 * Checkout — 3 steps: customer → shipping → demo payment.
 * Totals are always recomputed server-side; the client only displays them.
 * A successful POST /api/checkout clears the cart and creates a real order row.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ShieldCheck, CreditCard, Wallet, Check,
  Lock, Truck, ShoppingBag, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, money } from '../lib/api.js';
import { Button, EmptyState, LineSkeleton, SafeImage, Spinner } from '../components/ui.jsx';

const STEPS = ['Customer', 'Shipping', 'Payment'];

const inputCls =
  'mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';

function Field({ label, id, error, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-semibold text-ink-800">{label}</label>
      {children({ invalid: !!error })}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { cart, cartLoading, reloadCart } = useShop();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [customer, setCustomer] = useState({
    name: user?.name || '', email: user?.email || '', phone: '',
  });
  const [shipping, setShipping] = useState({
    address: '', city: '', state: '', postal: '', country: 'United States',
  });
  const [payment, setPayment] = useState({
    method: 'demo_card', name: '', number: '4242 4242 4242 4242', expiry: '12/30', cvv: '123',
  });

  const items = cart.items || [];

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.subtotal || 0), 0), [items]);

  if (authLoading) {
    return <div className="mx-auto max-w-5xl px-5 py-10"><div className="skeleton h-72 rounded-3xl" /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/checkout' }} />;
  }

  const setC = (k) => (e) => setCustomer((f) => ({ ...f, [k]: e.target.value }));
  const setS = (k) => (e) => setShipping((f) => ({ ...f, [k]: e.target.value }));
  const setP = (k) => (e) => setPayment((f) => ({ ...f, [k]: e.target.value }));

  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (customer.name.trim().length < 2) errs.name = 'Please enter your full name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errs.email = 'Enter a valid email address.';
      if (!/^[+()\d\s-]{7,20}$/.test(customer.phone)) errs.phone = 'Enter a valid phone number.';
    } else if (step === 1) {
      if (shipping.address.trim().length < 5) errs.address = 'Street address is required.';
      if (!shipping.city.trim()) errs.city = 'City is required.';
      if (!shipping.postal.trim()) errs.postal = 'Postal code is required.';
      if (!shipping.country.trim()) errs.country = 'Country is required.';
    } else if (step === 2 && payment.method === 'demo_card') {
      if (payment.name.trim().length < 2) errs.cardName = 'Cardholder name is required.';
      if (!/^\d{13,19}$/.test(payment.number.replace(/[\s-]/g, ''))) errs.cardNumber = 'Enter a 13–19 digit card number.';
      if (!/^\d{2}\s*\/\s*\d{2}$/.test(payment.expiry)) errs.expiry = 'Use MM/YY format.';
      if (!/^\d{3,4}$/.test(payment.cvv)) errs.cvv = '3 or 4 digits.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = (e) => {
    e.preventDefault();
    if (validateStep()) { setServerError(null); setStep((s) => Math.min(s + 1, 2)); }
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!validateStep() || busy) return;
    setBusy(true);
    setServerError(null);
    try {
      const data = await api.post('/api/checkout', { customer, shipping, payment });
      await reloadCart();
      toast.success('Payment successful — order placed!');
      navigate(`/order-confirmed/${data.order.id}`, { replace: true, state: { order: data.order } });
    } catch (err) {
      setServerError(err.message);
      if (err.data?.cart_issues?.length) {
        toast.error('Cart changed — please review your cart.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  // ---------------- empty cart ----------------
  if (cartLoading && items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="skeleton mb-4 h-8 w-56 rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="skeleton h-96 rounded-3xl" />
          <div className="skeleton h-64 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          description="Add a few treasures before heading to checkout."
          action={() => navigate('/marketplace')}
          actionLabel="Browse marketplace"
        />
      </div>
    );
  }

  const shippingCost = cart.shipping || 0;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-5 lg:px-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950 sm:text-3xl">Checkout</h1>
          <p className="mt-1 text-sm text-ink-500">Complete your order in a few quick steps.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-evergreen-500/10 px-3 py-1.5 text-xs font-semibold text-evergreen-600">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Secure demo checkout
        </span>
      </div>

      {/* ---------------- stepper ---------------- */}
      <ol className="mb-7 flex items-center gap-2 sm:gap-4" aria-label="Checkout progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition ${
                i < step ? 'bg-evergreen-500 text-white'
                  : i === step ? 'bg-ink-900 text-white ring-4 ring-brand-100'
                    : 'bg-ink-100 text-ink-400'}`}
            >
              {i < step ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className={`hidden text-sm sm:block ${i === step ? 'font-semibold text-ink-900' : 'text-ink-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < step ? 'bg-evergreen-500' : 'bg-ink-100'}`} />}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ---------------- form ---------------- */}
        <div className="animate-fade-up rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
          {serverError && (
            <p role="alert" className="mb-5 flex items-start gap-2 animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {serverError}
            </p>
          )}

          {step === 0 && (
            <form onSubmit={nextStep} noValidate>
              <h2 className="font-display text-lg font-semibold text-ink-950">Customer information</h2>
              <p className="mt-1 text-sm text-ink-500">Where we send your receipt and order updates.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" id="co-name" error={fieldErrors.name}>
                  {({ invalid }) => (
                    <input id="co-name" value={customer.name} onChange={setC('name')} autoComplete="name"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="Ava Thompson" />
                  )}
                </Field>
                <Field label="Email address" id="co-email" error={fieldErrors.email}>
                  {({ invalid }) => (
                    <input id="co-email" type="email" value={customer.email} onChange={setC('email')} autoComplete="email"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="you@example.com" />
                  )}
                </Field>
                <Field label="Phone number" id="co-phone" error={fieldErrors.phone} className="sm:col-span-2">
                  {({ invalid }) => (
                    <input id="co-phone" type="tel" value={customer.phone} onChange={setC('phone')} autoComplete="tel"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="+1 (555) 123-4567" />
                  )}
                </Field>
              </div>
              <div className="mt-6 flex justify-end">
                <Button type="submit" size="lg">Continue to shipping <ArrowRight className="h-4 w-4" aria-hidden /></Button>
              </div>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={nextStep} noValidate>
              <h2 className="font-display text-lg font-semibold text-ink-950">Shipping address</h2>
              {cart.hasDigital && !cart.hasPhysical ? (
                <p className="mt-1 text-sm text-evergreen-600">Your order is digital — items arrive by instant download, but we still keep an address on file.</p>
              ) : (
                <p className="mt-1 text-sm text-ink-500">Physical items ship from our independent sellers.</p>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Street address" id="co-address" error={fieldErrors.address} className="sm:col-span-2">
                  {({ invalid }) => (
                    <input id="co-address" value={shipping.address} onChange={setS('address')} autoComplete="street-address"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="123 Maple Street, Apt 4" />
                  )}
                </Field>
                <Field label="City" id="co-city" error={fieldErrors.city}>
                  {({ invalid }) => (
                    <input id="co-city" value={shipping.city} onChange={setS('city')} autoComplete="address-level2"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="Portland" />
                  )}
                </Field>
                <Field label="State / region" id="co-state">
                  {() => (
                    <input id="co-state" value={shipping.state} onChange={setS('state')} autoComplete="address-level1"
                      className={inputCls} placeholder="Oregon" />
                  )}
                </Field>
                <Field label="Postal code" id="co-postal" error={fieldErrors.postal}>
                  {({ invalid }) => (
                    <input id="co-postal" value={shipping.postal} onChange={setS('postal')} autoComplete="postal-code"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="97201" />
                  )}
                </Field>
                <Field label="Country" id="co-country" error={fieldErrors.country}>
                  {({ invalid }) => (
                    <input id="co-country" value={shipping.country} onChange={setS('country')} autoComplete="country-name"
                      aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="United States" />
                  )}
                </Field>
              </div>
              <div className="mt-6 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition hover:text-ink-900">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </button>
                <Button type="submit" size="lg">Continue to payment <ArrowRight className="h-4 w-4" aria-hidden /></Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={placeOrder} noValidate>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-ink-950">Payment</h2>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                  Demo payment — no real money will be charged
                </span>
              </div>

              {/* method picker */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button" onClick={() => setPayment((p) => ({ ...p, method: 'demo_card' }))}
                  aria-pressed={payment.method === 'demo_card'}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    payment.method === 'demo_card' ? 'border-brand-400 bg-brand-50/60 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300'}`}
                >
                  <CreditCard className="h-5 w-5 text-brand-600" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">Demo card</span>
                    <span className="block text-xs text-ink-500">Any future-expiry test card</span>
                  </span>
                </button>
                <button
                  type="button" onClick={() => setPayment((p) => ({ ...p, method: 'demo_wallet' }))}
                  aria-pressed={payment.method === 'demo_wallet'}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    payment.method === 'demo_wallet' ? 'border-brand-400 bg-brand-50/60 ring-2 ring-brand-100' : 'border-ink-200 hover:border-ink-300'}`}
                >
                  <Wallet className="h-5 w-5 text-brand-600" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">Demo wallet</span>
                    <span className="block text-xs text-ink-500">One-click, always approved</span>
                  </span>
                </button>
              </div>

              {payment.method === 'demo_card' && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Cardholder name" id="pay-name" error={fieldErrors.cardName} className="sm:col-span-2">
                    {({ invalid }) => (
                      <input id="pay-name" value={payment.name} onChange={setP('name')} autoComplete="cc-name"
                        aria-invalid={invalid} className={`${inputCls} ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="Ava Thompson" />
                    )}
                  </Field>
                  <Field label="Card number" id="pay-number" error={fieldErrors.cardNumber} className="sm:col-span-2">
                    {({ invalid }) => (
                      <input id="pay-number" inputMode="numeric" value={payment.number} onChange={setP('number')} autoComplete="cc-number"
                        aria-invalid={invalid} className={`${inputCls} font-mono ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="4242 4242 4242 4242" />
                    )}
                  </Field>
                  <Field label="Expiry (MM/YY)" id="pay-expiry" error={fieldErrors.expiry}>
                    {({ invalid }) => (
                      <input id="pay-expiry" value={payment.expiry} onChange={setP('expiry')} autoComplete="cc-exp"
                        aria-invalid={invalid} className={`${inputCls} font-mono ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="12/30" />
                    )}
                  </Field>
                  <Field label="CVV" id="pay-cvv" error={fieldErrors.cvv}>
                    {({ invalid }) => (
                      <input id="pay-cvv" inputMode="numeric" type="password" value={payment.cvv} onChange={setP('cvv')} autoComplete="cc-csc"
                        aria-invalid={invalid} className={`${inputCls} font-mono ${invalid ? 'border-red-300 ring-2 ring-red-100' : ''}`} placeholder="123" />
                    )}
                  </Field>
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
                    <ShieldCheck className="h-4 w-4 text-evergreen-500" aria-hidden />
                    Pre-filled with a valid demo card. Use a number ending in <b className="font-mono">0002</b> to test the declined-payment path.
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition hover:text-ink-900">
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </button>
                <Button type="submit" size="lg" loading={busy}>
                  {busy ? 'Processing…' : <>Pay {money(cart.total)} <ArrowRight className="h-4 w-4" aria-hidden /></>}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* ---------------- summary ---------------- */}
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold text-ink-950">Order summary</h2>

            <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <li key={item.product_id} className="flex items-center gap-3">
                  <SafeImage src={item.image} alt={item.title} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink-800">{item.title}</p>
                    <p className="text-[11px] text-ink-400">Qty {item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-ink-900">{money(item.subtotal)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2.5 border-t border-ink-100 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="font-semibold text-ink-900">{money(subtotal)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Shipping</dt>
                <dd className="font-semibold text-ink-900">{shippingCost === 0 ? <span className="text-evergreen-600">Free</span> : money(shippingCost)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-3">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="font-display text-2xl font-semibold text-ink-950">{money(cart.total)}</dd>
              </div>
            </dl>

            <ul className="mt-5 space-y-2.5 border-t border-ink-100 pt-4 text-xs text-ink-500">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /> Demo payment — no real money is charged</li>
              <li className="flex items-center gap-2"><Truck className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /> {cart.hasPhysical ? (shippingCost === 0 ? 'Free shipping on orders $50+' : 'Flat $5.99 shipping') : 'Instant digital delivery'}</li>
              <li className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /> Inventory is reserved the moment you pay</li>
            </ul>

            <Link to="/cart" className="mt-5 block text-center text-xs font-semibold text-brand-700 hover:underline">
              ← Edit cart
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
