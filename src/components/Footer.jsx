/** Site footer — marketplace / categories / sell / help / account columns. */
import { Link } from 'react-router-dom';
import { Sparkles, Github, Twitter, Instagram, Mail } from 'lucide-react';

const columns = [
  {
    title: 'Marketplace',
    links: [
      ['Home', '/'],
      ['Browse all', '/marketplace'],
      ['About us', '/about'],
      ['What’s new', '/marketplace?sort=newest'],
      ['Gift ideas', '/category/gifts'],
    ],
  },
  {
    title: 'Categories',
    links: [
      ['Handmade', '/category/handmade'],
      ['Jewelry', '/category/jewelry'],
      ['Home Decor', '/category/home-decor'],
      ['Vintage', '/category/vintage'],
      ['Digital Products', '/category/digital-products'],
    ],
  },
  {
    title: 'Sell',
    links: [
      ['Sell on Craftly', '/seller?setup=1'],
      ['Seller dashboard', '/seller'],
      ['Seller handbook', '/help'],
      ['Inventory tools', '/seller/inventory'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Help centre', '/help'],
      ['Contact us', '/contact'],
      ['Shipping info', '/help'],
      ['Returns & refunds', '/help'],
    ],
  },
  {
    title: 'Account',
    links: [
      ['My profile', '/account'],
      ['Orders', '/orders'],
      ['Wishlist', '/wishlist'],
      ['Cart', '/cart'],
      ['Sign in', '/login'],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-[1400px] px-5 py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2" aria-label="Craftly home">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-display text-[22px] font-semibold text-ink-950">Craftly</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              A marketplace for handmade, vintage and digital goods — made by independent makers, bought by people who care.
            </p>
            <div className="mt-4 flex gap-2">
              {[Twitter, Instagram, Github, Mail].map((Icon, i) => (
                <span key={i} className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 text-ink-500 transition hover:border-brand-400 hover:text-brand-600">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map(([label, to]) => (
                  <li key={label + to}>
                    <Link to={to} className="text-sm text-ink-600 transition hover:text-brand-700">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Craftly Marketplace — an original demo project. Not affiliated with Etsy.</p>
          <p>Built with React · Express · Turso (libSQL)</p>
        </div>
      </div>
    </footer>
  );
}
