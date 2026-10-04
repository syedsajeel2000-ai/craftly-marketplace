/**
 * API client — every server call goes through here.
 * Cookie-based sessions; credentials are always sent.
 * Normalises errors so UI never sees raw server/DB messages.
 */

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Network error — check your connection and try again.', 0);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const message = data?.error || (res.status === 404
      ? 'Not found.'
      : 'Something went wrong. Please try again.');
    throw new ApiError(message, res.status, data || {});
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, body, opts) => request(path, { ...opts, method: 'DELETE', body }),
};

/** Builds /api/products?... query strings, skipping empty values. */
export function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === 'all') return;
    search.set(k, v);
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T').replace(/Z?$/, (m) => (m || 'Z')));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function timeAgo(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T').replace(/Z?$/, (m) => (m || 'Z')));
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
  return formatDate(value);
}
