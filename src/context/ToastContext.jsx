/** Toast notifications — success / error / info with queue + auto-dismiss. */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((message, type = 'success', duration = 3200) => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-3), { id, message, type }]);
    if (duration) {
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    toasts,
    dismiss,
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d),
    info: (m, d) => push(m, 'info', d),
  }), [toasts, dismiss, push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-5 sm:top-5 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }) {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-evergreen-500" aria-hidden />,
    error: <XCircle className="h-5 w-5 text-red-500" aria-hidden />,
    info: <Info className="h-5 w-5 text-brand-500" aria-hidden />,
  };
  const ring = toast.type === 'error' ? 'ring-red-200' : toast.type === 'info' ? 'ring-brand-200' : 'ring-evergreen-500/20';
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-pop ring-1 ${ring} ring-offset-0`}
    >
      <div className="mt-0.5 shrink-0">{icons[toast.type] || icons.info}</div>
      <p className="flex-1 text-sm font-medium leading-snug text-ink-800">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-full p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
