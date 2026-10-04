/** Sign up page — full name, username, email, password, confirm + role choice. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '../components/ui.jsx';

const initial = { name: '', username: '', email: '', password: '', confirm: '', role: 'buyer' };

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const value = k === 'role' ? e.target.value : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    setErrors((er) => ({ ...er, [k]: null }));
  };

  const validate = () => {
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Please enter your full name.';
    if (!/^[a-z0-9_]{3,20}$/i.test(form.username.trim())) er.username = '3–20 characters: letters, numbers, underscores.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) er.email = 'Please enter a valid email.';
    if (form.password.length < 8) er.password = 'At least 8 characters.';
    if (form.password !== form.confirm) er.confirm = 'Passwords do not match.';
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await register({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm: form.confirm,
        role: form.role,
      });
      toast.success('Account created — welcome to Craftly!');
      navigate(form.role === 'seller' ? '/seller' : '/', { replace: true });
    } catch (err) {
      setServerError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, props, error) => (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink-800">{label}</label>
      <input
        id={id} {...props}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-sm transition focus:outline-none focus:ring-4 ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-ink-200 focus:border-brand-400 focus:ring-brand-100'}`}
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 py-12 sm:py-16">
      <div className="animate-fade-up rounded-3xl border border-ink-100 bg-white p-7 shadow-card sm:p-9">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">Create your account</h1>
          <p className="mt-1 text-sm text-ink-500">Join a marketplace built for makers</p>
        </div>

        {serverError && (
          <p role="alert" className="mb-4 animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{serverError}</p>
        )}

        <form onSubmit={submit} noValidate className="space-y-4">
          {field('name', 'Full name', { type: 'text', autoComplete: 'name', value: form.name, onChange: set('name'), placeholder: 'Jamie Rivera' }, errors.name)}
          {field('username', 'Username', { type: 'text', autoComplete: 'username', value: form.username, onChange: set('username'), placeholder: 'jamie_makes' }, errors.username)}
          {field('email', 'Email', { type: 'email', autoComplete: 'email', value: form.email, onChange: set('email'), placeholder: 'you@example.com' }, errors.email)}
          {field('password', 'Password', { type: 'password', autoComplete: 'new-password', value: form.password, onChange: set('password'), placeholder: 'At least 8 characters' }, errors.password)}
          {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password', value: form.confirm, onChange: set('confirm'), placeholder: 'Repeat your password' }, errors.confirm)}

          <fieldset>
            <legend className="text-sm font-semibold text-ink-800">Account type</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2.5">
              {[['buyer', 'Buyer', 'Shop from independent makers'], ['seller', 'Seller', 'Open a shop and list products']].map(([value, title, copy]) => (
                <label
                  key={value}
                  className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3.5 text-left transition ${form.role === value ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white hover:border-ink-300'}`}
                >
                  <input type="radio" name="role" value={value} checked={form.role === value} onChange={set('role')} className="sr-only" />
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink-900">{title}</span>
                    {form.role === value && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
                  </span>
                  <span className="mt-0.5 text-xs text-ink-500">{copy}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit" size="lg" loading={busy} className="w-full">
            {busy ? 'Creating account…' : <>Create account <ArrowRight className="h-4 w-4" aria-hidden /></>}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
