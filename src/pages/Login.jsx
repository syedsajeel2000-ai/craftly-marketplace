/** Sign in page — email or username + password. */
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Spinner } from '../components/ui.jsx';
import { useSecretDemo } from '../lib/secretDemo.js';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!form.identifier.trim() || !form.password) {
      setError('Please enter your email/username and password.');
      return;
    }
    setBusy(true);
    try {
      await login(form.identifier.trim(), form.password);
      toast.success('Login successful');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => setForm({ identifier: 'ava@example.com', password: 'Password123!' });
  const fillSeller = () => setForm({ identifier: 'maya@example.com', password: 'Password123!' });

  // Demo credentials are hidden until someone types the secret phrase with
  // CapsLock held down (see src/lib/secretDemo.js).
  const onUnlock = useCallback((msg) => toast.info(msg), [toast]);
  const { unlocked: demoUnlocked, lock: hideDemo } = useSecretDemo(onUnlock);

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 py-12 sm:py-16">
      <div className="animate-fade-up rounded-3xl border border-ink-100 bg-white p-7 shadow-card sm:p-9">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to your Craftly account</p>
        </div>

        {error && (
          <p role="alert" className="mb-4 animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor="identifier" className="text-sm font-semibold text-ink-800">Email or username</label>
            <input
              id="identifier" type="text" autoComplete="username" required
              value={form.identifier} onChange={set('identifier')}
              placeholder="you@example.com"
              className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-semibold text-ink-800">Password</label>
            <input
              id="password" type="password" autoComplete="current-password" required
              value={form.password} onChange={set('password')}
              placeholder="••••••••"
              className="mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <Button type="submit" size="lg" loading={busy} className="w-full">
            {busy ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" aria-hidden /></>}
          </Button>
        </form>

        {demoUnlocked && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-brand-800">Demo accounts</p>
              <button
                type="button"
                onClick={hideDemo}
                aria-label="Hide demo accounts"
                className="-mr-1 -mt-1 grid h-6 w-6 place-items-center rounded-full text-brand-700 transition hover:bg-brand-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={fillDemo} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100">
                Buyer (ava@example.com)
              </button>
              <button type="button" onClick={fillSeller} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100">
                Seller (maya@example.com)
              </button>
            </div>
            <p className="mt-2 text-[11px] text-brand-700">Password for both: Password123!</p>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-ink-500">
          New to Craftly?{' '}
          <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
