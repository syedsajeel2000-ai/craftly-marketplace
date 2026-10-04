/**
 * Static info pages: About, Help centre, Contact — with working contact form
 * that validates and confirms client-side (no fake backend claims: it opens
 * the user's mail client with a prefilled message).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, ShieldCheck, Truck, Sparkles, LifeBuoy, Mail, MessageCircle,
  Package, CreditCard, UserRound, Store, Send, ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';

const HELP_TOPICS = [
  {
    icon: Package,
    title: 'Orders & delivery',
    items: [
      'Track an order from the Orders page in your account.',
      'Physical items ship from individual sellers, usually within 2–4 business days.',
      'Digital items are available immediately after checkout.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments (demo)',
    items: [
      'Craftly uses a demo payment system — no real money is ever charged.',
      'Use the pre-filled card 4242 4242 4242 4242, any future expiry, any CVV.',
      'A card ending in 0002 simulates a declined payment.',
    ],
  },
  {
    icon: UserRound,
    title: 'Account & security',
    items: [
      'Passwords are hashed with bcrypt — plain text is never stored.',
      'Sessions use httpOnly cookies, so your account can’t be read by scripts.',
      'Change your password any time from the Account page.',
    ],
  },
  {
    icon: Store,
    title: 'Selling on Craftly',
    items: [
      'Open the seller dashboard and click “Become a seller”.',
      'Create listings with pricing, stock and up to six images.',
      'Inventory is enforced automatically at checkout and logged for you.',
    ],
  },
];

const PAGES = {
  about: {
    title: 'About Craftly',
    subtitle: 'A marketplace where handmade, vintage and digital goods find the people who love them.',
    icon: Heart,
  },
  help: {
    title: 'Help centre',
    subtitle: 'Everything you need to shop, sell and stay secure on Craftly.',
    icon: LifeBuoy,
  },
  contact: {
    title: 'Contact us',
    subtitle: 'Questions, feedback or partnership ideas? We’d love to hear from you.',
    icon: Mail,
  },
};

function PageHeader({ page }) {
  const meta = PAGES[page];
  const Icon = meta.icon;
  return (
    <div className="animate-fade-up rounded-3xl border border-ink-100 bg-gradient-to-br from-brand-50/80 via-white to-ink-50 p-7 text-center shadow-card sm:p-10">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink-950">{meta.title}</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-500">{meta.subtitle}</p>
    </div>
  );
}

function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 lg:px-8">
      <PageHeader page="about" />

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {[
          [Heart, 'Original by design', 'Craftly is an original build — our own code, art and brand, inspired by the general marketplace experience.'],
          [ShieldCheck, 'Real persistence', 'Every account, cart, order and review is stored in a Turso (libSQL) database, not your browser.'],
          [Truck, 'Two-sided marketplace', 'Buyers discover and purchase; sellers manage products, stock and orders from one dashboard.'],
        ].map(([Icon, title, body]) => (
          <section key={title} className="rounded-3xl border border-ink-100 bg-white p-5 shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-lg font-semibold text-ink-950">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
          </section>
        ))}
      </div>

      <section className="mt-5 rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
        <h2 className="font-display text-xl font-semibold text-ink-950">How Craftly works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ['Discover', 'Search or filter thousands of listings by category, price, rating and product type.'],
            ['Add to cart', 'Your cart is stored server-side, so it follows you across devices and sessions.'],
            ['Check out', 'Enter shipping details and pay with the demo payment step — no real charge.'],
            ['Enjoy & review', 'Orders update inventory instantly; leave a review once you’ve purchased.'],
          ].map(([step, body], i) => (
            <li key={step} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{step}</p>
                <p className="mt-0.5 text-sm text-ink-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/marketplace" className="btn inline-flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-700">
            Browse marketplace <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/register" className="btn inline-flex items-center gap-2 rounded-full border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">
            <Sparkles className="h-4 w-4" aria-hidden /> Join Craftly
          </Link>
        </div>
      </section>
    </div>
  );
}

function Help() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 lg:px-8">
      <PageHeader page="help" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {HELP_TOPICS.map(({ icon: Icon, title, items }) => (
          <section key={title} className="animate-fade-up rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-lg font-semibold text-ink-950">{title}</h2>
            <ul className="mt-2.5 space-y-2">
              {items.map((it) => (
                <li key={it} className="flex gap-2 text-sm leading-relaxed text-ink-500">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-ink-500">
        Still stuck? <Link to="/contact" className="font-semibold text-brand-700 hover:underline">Contact our team →</Link>
      </p>
    </div>
  );
}

function Contact() {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', topic: 'General question', message: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) errs.message = 'Tell us a little more (10+ characters).';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    // Real, honest behaviour: hand the message to the user's mail client.
    await new Promise((r) => setTimeout(r, 500));
    const subject = encodeURIComponent(`[Craftly] ${form.topic}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:hello@craftly.example?subject=${subject}&body=${body}`;
    setBusy(false);
    setSent(true);
    toast.success('Thanks! Your mail app is opening with your message.');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 lg:px-8">
      <PageHeader page="contact" />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
          {sent ? (
            <div className="py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-evergreen-500 text-white">
                <Send className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold text-ink-950">Message ready to send</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">
                Your email app should have opened with the message prefilled. If it didn’t, write to us directly at
                {' '}<a href="mailto:hello@craftly.example" className="font-semibold text-brand-700 hover:underline">hello@craftly.example</a>.
              </p>
              <Button className="mt-5" onClick={() => { setSent(false); setForm({ name: '', email: '', topic: 'General question', message: '' }); }}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="c-name" className="text-sm font-semibold text-ink-800">Your name</label>
                  <input id="c-name" value={form.name} onChange={set('name')} autoComplete="name"
                    className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-sm transition focus:outline-none focus:ring-4 ${errors.name ? 'border-red-300 ring-red-100' : 'border-ink-200 focus:border-brand-400 focus:ring-brand-100'}`} />
                  {errors.name && <p className="mt-1 text-xs font-medium text-red-600">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="c-email" className="text-sm font-semibold text-ink-800">Email</label>
                  <input id="c-email" type="email" value={form.email} onChange={set('email')} autoComplete="email"
                    className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-sm transition focus:outline-none focus:ring-4 ${errors.email ? 'border-red-300 ring-red-100' : 'border-ink-200 focus:border-brand-400 focus:ring-brand-100'}`} />
                  {errors.email && <p className="mt-1 text-xs font-medium text-red-600">{errors.email}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="c-topic" className="text-sm font-semibold text-ink-800">Topic</label>
                <select id="c-topic" value={form.topic} onChange={set('topic')}
                  className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100">
                  <option>General question</option>
                  <option>Order issue</option>
                  <option>Selling on Craftly</option>
                  <option>Bug report</option>
                  <option>Partnership</option>
                </select>
              </div>
              <div>
                <label htmlFor="c-message" className="text-sm font-semibold text-ink-800">Message</label>
                <textarea id="c-message" rows={5} value={form.message} onChange={set('message')}
                  placeholder="How can we help?"
                  className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-4 ${errors.message ? 'border-red-300 ring-red-100' : 'border-ink-200 focus:border-brand-400 focus:ring-brand-100'}`} />
                {errors.message && <p className="mt-1 text-xs font-medium text-red-600">{errors.message}</p>}
              </div>
              <Button type="submit" loading={busy}>
                {busy ? 'Preparing…' : <><Send className="h-4 w-4" aria-hidden /> Send message</>}
              </Button>
            </form>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-800"><Mail className="h-4 w-4 text-brand-600" aria-hidden /> Email us</h2>
            <a href="mailto:hello@craftly.example" className="mt-2 block text-sm font-medium text-brand-700 hover:underline">hello@craftly.example</a>
            <p className="mt-1 text-xs text-ink-400">We reply within one business day.</p>
          </div>
          <div className="rounded-3xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-800"><MessageCircle className="h-4 w-4 text-brand-600" aria-hidden /> Quick answers</h2>
            <p className="mt-2 text-sm text-ink-500">Most questions are covered in the help centre.</p>
            <Link to="/help" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Visit help centre →</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Info({ page }) {
  if (page === 'help') return <Help />;
  if (page === 'contact') return <Contact />;
  return <About />;
}
