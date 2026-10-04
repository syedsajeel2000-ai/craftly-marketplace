/** Site header — logo, search, categories, account, wishlist, cart, mobile drawer. */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, ShoppingCart, Heart, User, Menu, X, LayoutDashboard, Package,
  LogOut, Store, ChevronDown, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const CATEGORIES = [
  ['Handmade', 'handmade'], ['Jewelry', 'jewelry'], ['Home Decor', 'home-decor'],
  ['Digital Products', 'digital-products'], ['Vintage', 'vintage'], ['Art', 'art'],
  ['Clothing', 'clothing'], ['Gifts', 'gifts'], ['Accessories', 'accessories'],
];

export default function Header() {
  const { user, logout, isSeller } = useAuth();
  const { cartCount, wishCount, cartBump } = useShop();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [query, setQuery] = useState(params.get('q') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef(null);
  const catRef = useRef(null);

  // keep search box in sync with URL
  useEffect(() => { setQuery(params.get('q') || ''); }, [params]);
  // close drawers on navigation
  useEffect(() => { setMenuOpen(false); setCatOpen(false); setUserOpen(false); }, [location.pathname, location.search]);
  // lock scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);
  // close dropdowns on outside click / Escape
  useEffect(() => {
    const onDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserOpen(false);
      if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setUserOpen(false); setCatOpen(false); setMenuOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`);
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  const cartLink = (
    <Link to="/cart" aria-label={`Shopping cart, ${cartCount} items`} className="btn relative rounded-full p-2 text-ink-700 transition hover:bg-ink-100">
      <ShoppingCart className="h-[22px] w-[22px]" aria-hidden />
      {cartCount > 0 && (
        <span
          key={cartBump}
          className="absolute -right-0.5 -top-0.5 grid min-w-[18px] animate-bump place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-[18px] text-white"
        >
          {cartCount > 99 ? '99+' : cartCount}
        </span>
      )}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/90 backdrop-blur-md">
      {/* ---------- top row ---------- */}
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-3 sm:gap-4 sm:px-5 lg:px-8">
        {/* mobile menu button */}
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="-ml-1 rounded-full p-2 text-ink-800 transition hover:bg-ink-100 lg:hidden">
          <Menu className="h-6 w-6" aria-hidden />
        </button>

        {/* logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Craftly home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display text-[22px] font-semibold tracking-tight text-ink-950">Craftly</span>
        </Link>

        {/* search */}
        <form onSubmit={submitSearch} role="search" className="hidden flex-1 items-center md:flex">
          <div className="relative w-full max-w-2xl">
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input
              id="site-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for handmade necklaces, vintage lamps…"
              className="h-11 w-full rounded-full border border-ink-200 bg-ink-50/70 pl-11 pr-24 text-sm text-ink-900 placeholder:text-ink-400 transition focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
            <button type="submit" className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-brand-600 px-4 text-xs font-bold text-white transition hover:bg-brand-700 active:scale-95">
              Search
            </button>
          </div>
        </form>

        {/* right actions */}
        <nav className="ml-auto flex items-center gap-0.5 sm:gap-1.5" aria-label="Account">
          <Link to="/wishlist" aria-label={`Wishlist, ${wishCount} items`} className="btn relative rounded-full p-2 text-ink-700 transition hover:bg-ink-100">
            <Heart className="h-[22px] w-[22px]" aria-hidden />
            {wishCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-[18px] text-white">{wishCount > 99 ? '99+' : wishCount}</span>
            )}
          </Link>
          <span className="hidden sm:block">{cartLink}</span>

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userOpen}
                className="ml-1 flex items-center gap-1.5 rounded-full border border-ink-200 py-1 pl-1 pr-2 transition hover:border-ink-300 hover:bg-ink-50"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {user.name?.[0]?.toUpperCase()}
                </span>
                <span className="hidden max-w-[90px] truncate text-xs font-semibold text-ink-700 lg:block">{user.name?.split(' ')[0]}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-ink-400 transition ${userOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {userOpen && (
                <div role="menu" className="absolute right-0 top-12 w-60 animate-scale-in overflow-hidden rounded-2xl border border-ink-100 bg-white py-1.5 shadow-pop">
                  <div className="border-b border-ink-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
                    <p className="truncate text-xs text-ink-400">@{user.username} · {user.role}</p>
                  </div>
                  <MenuLink to="/account" icon={User}>My profile</MenuLink>
                  <MenuLink to="/orders" icon={Package}>Orders</MenuLink>
                  <MenuLink to="/wishlist" icon={Heart}>Wishlist</MenuLink>
                  <MenuLink to={isSeller ? '/seller' : '/seller?setup=1'} icon={isSeller ? LayoutDashboard : Store}>
                    {isSeller ? 'Seller dashboard' : 'Start selling'}
                  </MenuLink>
                  <div className="my-1 border-t border-ink-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <Link to="/login" className="btn hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-800 transition hover:bg-ink-100 sm:block">
                Sign in
              </Link>
              <Link to="/register" className="btn rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 active:scale-95">
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* ---------- categories bar (desktop) ---------- */}
      <div className="hidden border-t border-ink-100/70 bg-white lg:block" ref={catRef}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-8 py-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((v) => !v)}
              aria-expanded={catOpen}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-100"
            >
              <Menu className="h-4 w-4" aria-hidden /> Categories
              <ChevronDown className={`h-3.5 w-3.5 transition ${catOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {catOpen && (
              <div className="absolute left-0 top-10 w-64 animate-scale-in rounded-2xl border border-ink-100 bg-white p-2 shadow-pop">
                {CATEGORIES.map(([name, slug]) => (
                  <Link key={slug} to={`/category/${slug}`} className="btn block rounded-xl px-3 py-2.5 text-sm text-ink-700 transition hover:bg-brand-50 hover:text-brand-800">
                    {name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="h-4 w-px bg-ink-200" />
          {CATEGORIES.slice(0, 7).map(([name, slug]) => (
            <NavLink
              key={slug}
              to={`/category/${slug}`}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 text-[13px] transition ${isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'}`
              }
            >
              {name}
            </NavLink>
          ))}
          <NavLink
            to="/shops"
            className={({ isActive }) =>
              `ml-auto rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'}`}
          >
            Shops
          </NavLink>
          <NavLink to="/marketplace?sort=newest" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-brand-700 transition hover:bg-brand-50">
            What’s new
          </NavLink>
        </div>
      </div>

      {/* ---------- mobile search ---------- */}
      <div className="border-t border-ink-100/70 px-3 py-2 md:hidden">
        <form onSubmit={submitSearch} role="search" className="relative">
          <label htmlFor="mobile-search" className="sr-only">Search products</label>
          <input
            id="mobile-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Craftly…"
            className="h-10 w-full rounded-full border border-ink-200 bg-ink-50/70 pl-10 pr-4 text-sm transition focus:border-brand-400 focus:bg-white focus:outline-none"
          />
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
        </form>
      </div>

      {/* ---------- mobile drawer ---------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm animate-slide-right flex-col bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-4">
              <span className="font-display text-xl font-semibold text-ink-950">Menu</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-full p-2 text-ink-500 transition hover:bg-ink-100">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile navigation">
              <MobileLink to="/" icon={Sparkles}>Home</MobileLink>
              <MobileLink to="/marketplace" icon={Search}>Browse marketplace</MobileLink>
              <MobileLink to="/shops" icon={Store}>Shops</MobileLink>

              <p className="mt-5 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Categories</p>
              {CATEGORIES.map(([name, slug]) => (
                <MobileLink key={slug} to={`/category/${slug}`} small>{name}</MobileLink>
              ))}

              <p className="mt-5 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">Account</p>
              {user ? (
                <>
                  <MobileLink to="/orders" icon={Package}>Orders</MobileLink>
                  <MobileLink to="/wishlist" icon={Heart}>Wishlist</MobileLink>
                  <MobileLink to="/cart" icon={ShoppingCart}>Cart</MobileLink>
                  <MobileLink to="/account" icon={User}>Profile</MobileLink>
                  <MobileLink to={isSeller ? '/seller' : '/seller?setup=1'} icon={isSeller ? LayoutDashboard : Store}>
                    {isSeller ? 'Seller dashboard' : 'Start selling'}
                  </MobileLink>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-5 w-5" aria-hidden /> Log out
                  </button>
                </>
              ) : (
                <div className="mt-3 flex flex-col gap-2.5 px-3">
                  <Link to="/login" className="btn rounded-full border border-ink-200 px-4 py-3 text-center text-sm font-semibold text-ink-800 transition active:scale-95">
                    Sign in
                  </Link>
                  <Link to="/register" className="btn rounded-full bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white transition active:scale-95">
                    Create account
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({ to, icon: Icon, children }) {
  return (
    <Link to={to} role="menuitem" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50">
      <Icon className="h-4 w-4 text-ink-400" aria-hidden /> {children}
    </Link>
  );
}

function MobileLink({ to, icon: Icon, children, small }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${small ? 'font-medium text-ink-600' : 'font-semibold text-ink-800'} ${isActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50'}`
      }
    >
      {Icon && <Icon className="h-[18px] w-[18px] text-ink-400" aria-hidden />}
      {children}
    </NavLink>
  );
}
