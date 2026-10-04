/** 404 — unknown routes land here. */
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center sm:py-24">
      <div className="animate-fade-up">
        <span className="relative mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100">
          <span className="font-display text-5xl font-semibold text-brand-600">404</span>
          <Compass className="absolute -right-2 -top-2 h-7 w-7 text-brand-400" aria-hidden />
        </span>

        <h1 className="mt-7 font-display text-3xl font-semibold text-ink-950">Page not found</h1>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-ink-500">
          The page you’re looking for was moved, deleted, or never existed.
          Don’t worry — the marketplace is just a click away.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="btn inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-700 active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Go home
          </Link>
          <Link
            to="/marketplace"
            className="btn inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-800 transition hover:bg-ink-50 active:scale-[0.97]"
          >
            <Search className="h-4 w-4" aria-hidden /> Continue shopping
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
