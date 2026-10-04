/**
 * Account — profile editing + password change.
 * Users can only ever read/edit their own row (server enforces this).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, KeyRound, Package, Heart, Store, LogOut, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, formatDate } from '../lib/api.js';
import { Button, EmptyState, PageLoader } from '../components/ui.jsx';

const inputCls =
  'mt-1.5 h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100';

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function Account() {
  const { user, loading, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', username: '', email: '', bio: '', avatar: '' });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '', username: user.username || '', email: user.email || '',
        bio: user.bio || '', avatar: user.avatar || '',
      });
    }
  }, [user]);

  if (loading) return <PageLoader label="Loading your account…" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          icon="inbox"
          title="Sign in to manage your account"
          description="Update your profile, change your password and see your order history."
          action={() => navigate('/login', { state: { from: '/account' } })}
          actionLabel="Sign in"
          secondary={<Link to="/register" className="btn rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-ink-50">Create account</Link>}
        />
      </div>
    );
  }

  const setP = (k) => (e) => setProfile((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    if (profileBusy) return;
    setProfileError(null);
    if (profile.name.trim().length < 2) return setProfileError('Name must be at least 2 characters.');
    if (!/^[a-z0-9_]{3,20}$/i.test(profile.username)) return setProfileError('Username must be 3–20 characters (letters, numbers, underscores).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return setProfileError('Please enter a valid email address.');

    setProfileBusy(true);
    try {
      const data = await api.put('/api/profile', profile);
      setUser(data.user);
      toast.success('Profile updated');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwBusy) return;
    setPwError(null);
    if (pw.new_password.length < 8) return setPwError('New password must be at least 8 characters.');
    if (pw.new_password !== pw.confirm_password) return setPwError('New passwords do not match.');

    setPwBusy(true);
    try {
      const data = await api.put('/api/profile/password', pw);
      toast.success(data.message || 'Password updated');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 lg:px-8">
      {/* header card */}
      <div className="mb-6 flex animate-fade-up flex-wrap items-center gap-4 rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
        <div className="relative">
          <img
            src={user.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
            alt=""
            className="h-20 w-20 rounded-full border-2 border-brand-100 object-cover"
            onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`; }}
          />
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white ring-2 ring-white">
            <Camera className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-ink-950">{user.name}</h1>
          <p className="text-sm text-ink-500">@{user.username} · joined {formatDate(user.created_at)}</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            user.role === 'seller' ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'}`}>
            {user.role === 'seller' ? <Store className="h-3 w-3" aria-hidden /> : <User className="h-3 w-3" aria-hidden />}
            {user.role}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/orders" className="btn inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50">
            <Package className="h-4 w-4" aria-hidden /> Orders
          </Link>
          <Link to="/wishlist" className="btn inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50">
            <Heart className="h-4 w-4" aria-hidden /> Wishlist
          </Link>
          <Link to={user.role === 'seller' ? '/seller' : '/seller?setup=1'} className="btn inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50">
            <Store className="h-4 w-4" aria-hidden /> {user.role === 'seller' ? 'Dashboard' : 'Start selling'}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* profile form */}
        <Section icon={User} title="Profile details" description="How you appear to sellers and other buyers.">
          <form onSubmit={saveProfile} noValidate className="space-y-4">
            {profileError && (
              <p role="alert" className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{profileError}</p>
            )}
            <div>
              <label htmlFor="pf-name" className="text-sm font-semibold text-ink-800">Full name</label>
              <input id="pf-name" value={profile.name} onChange={setP('name')} autoComplete="name" className={inputCls} />
            </div>
            <div>
              <label htmlFor="pf-username" className="text-sm font-semibold text-ink-800">Username</label>
              <input id="pf-username" value={profile.username} onChange={setP('username')} autoComplete="username" className={inputCls} />
              <p className="mt-1 text-xs text-ink-400">3–20 characters: letters, numbers, underscores.</p>
            </div>
            <div>
              <label htmlFor="pf-email" className="text-sm font-semibold text-ink-800">Email</label>
              <input id="pf-email" type="email" value={profile.email} onChange={setP('email')} autoComplete="email" className={inputCls} />
            </div>
            <div>
              <label htmlFor="pf-bio" className="text-sm font-semibold text-ink-800">Bio</label>
              <textarea
                id="pf-bio" rows={3} maxLength={500} value={profile.bio} onChange={setP('bio')}
                placeholder="Tell the community a little about yourself…"
                className="mt-1.5 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>
            <div>
              <label htmlFor="pf-avatar" className="text-sm font-semibold text-ink-800">Avatar URL</label>
              <input id="pf-avatar" type="url" value={profile.avatar} onChange={setP('avatar')} placeholder="https://…" className={inputCls} />
            </div>
            <Button type="submit" loading={profileBusy} className="w-full sm:w-auto">
              {profileBusy ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Section>

        {/* password form */}
        <Section icon={KeyRound} title="Change password" description="Hashed with bcrypt — we never store plain text.">
          <form onSubmit={savePassword} noValidate className="space-y-4">
            {pwError && (
              <p role="alert" className="animate-fade-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{pwError}</p>
            )}
            <div>
              <label htmlFor="pw-current" className="text-sm font-semibold text-ink-800">Current password</label>
              <input
                id="pw-current" type="password" autoComplete="current-password" required
                value={pw.current_password}
                onChange={(e) => setPw((f) => ({ ...f, current_password: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="text-sm font-semibold text-ink-800">New password</label>
              <input
                id="pw-new" type="password" autoComplete="new-password" required
                value={pw.new_password}
                onChange={(e) => setPw((f) => ({ ...f, new_password: e.target.value }))}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-ink-400">At least 8 characters.</p>
            </div>
            <div>
              <label htmlFor="pw-confirm" className="text-sm font-semibold text-ink-800">Confirm new password</label>
              <input
                id="pw-confirm" type="password" autoComplete="new-password" required
                value={pw.confirm_password}
                onChange={(e) => setPw((f) => ({ ...f, confirm_password: e.target.value }))}
                className={inputCls}
              />
            </div>
            <Button type="submit" variant="dark" loading={pwBusy} className="w-full sm:w-auto">
              {pwBusy ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </Section>
      </div>
    </div>
  );
}
