'use client';

import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'danger' | 'warning' | 'info';

export type ToastOptions = {
  description?: string;
  duration?: number;
  id?: string;
};

type ToastItem = ToastOptions & {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  dismiss: (id: string) => void;
  show: (message: string, tone?: ToastTone, options?: ToastOptions) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_EVENT = 'imart:toast';
const DISMISS_EVENT = 'imart:toast-dismiss';
const PENDING_TOAST_KEY = 'imart:pending-toast';
const DEFAULT_DURATION = 4500;
let toastSequence = 0;

function makeId() {
  toastSequence += 1;
  return `toast-${Date.now()}-${toastSequence}`;
}

function emit(message: string, tone: ToastTone, options?: ToastOptions) {
  const id = options?.id ?? makeId();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { ...options, id, message, tone } satisfies ToastItem }));
  }
  return id;
}

export const toast = {
  success: (message: string, options?: ToastOptions) => emit(message, 'success', options),
  error: (message: string, options?: ToastOptions) => emit(message, 'error', options),
  danger: (message: string, options?: ToastOptions) => emit(message, 'danger', options),
  warning: (message: string, options?: ToastOptions) => emit(message, 'warning', options),
  info: (message: string, options?: ToastOptions) => emit(message, 'info', options),
  /**
   * Queues a toast to show after a full page navigation/reload, which would
   * otherwise wipe it before it's ever seen (e.g. switching company/branch,
   * which redirects to the dashboard). `ToastProvider` flushes this on mount.
   */
  queueForNextLoad: (message: string, tone: ToastTone = 'success', options?: ToastOptions) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify({ message, tone, options }));
  },
  dismiss: (id?: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(DISMISS_EVENT, { detail: id }));
  },
};

const toneStyles: Record<ToastTone, { icon: typeof Info; iconClass: string; barClass: string }> = {
  success: { icon: CheckCircle2, iconClass: 'bg-emerald-100 text-emerald-700', barClass: 'bg-emerald-500' },
  error: { icon: CircleAlert, iconClass: 'bg-red-100 text-red-700', barClass: 'bg-red-500' },
  danger: { icon: CircleAlert, iconClass: 'bg-red-100 text-red-700', barClass: 'bg-red-500' },
  warning: { icon: TriangleAlert, iconClass: 'bg-amber-100 text-amber-700', barClass: 'bg-amber-500' },
  info: { icon: Info, iconClass: 'bg-blue-100 text-blue-700', barClass: 'bg-blue-500' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone = 'info', options?: ToastOptions) => {
    const item: ToastItem = { ...options, id: options?.id ?? makeId(), message, tone };
    setItems((current) => [...current.filter((entry) => entry.id !== item.id), item].slice(-4));
    return item.id;
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_TOAST_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_TOAST_KEY);
    try {
      const pending = JSON.parse(raw) as { message: string; tone: ToastTone; options?: ToastOptions };
      show(pending.message, pending.tone, pending.options);
    } catch {
      // Ignore a malformed or stale payload.
    }
  }, [show]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const item = (event as CustomEvent<ToastItem>).detail;
      setItems((current) => [...current.filter((entry) => entry.id !== item.id), item].slice(-4));
    };
    const onDismiss = (event: Event) => {
      const id = (event as CustomEvent<string | undefined>).detail;
      setItems((current) => (id ? current.filter((item) => item.id !== id) : []));
    };
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(DISMISS_EVENT, onDismiss);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(DISMISS_EVENT, onDismiss);
    };
  }, []);

  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        // top-[4.5rem] clears the h-14 mobile/tablet header (which holds the sidebar's
        // hamburger button) below lg; at lg+ the header has no overlapping control there.
        className="pointer-events-none fixed inset-x-3 top-[4.5rem] z-[100] flex flex-col items-end gap-1.5 sm:inset-x-auto sm:right-4 sm:top-[4.5rem] sm:w-[min(20rem,calc(100vw-2rem))] lg:top-4"
      >
        {items.map((item) => <ToastCard key={item.id} item={item} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = useRef(item.duration ?? DEFAULT_DURATION);
  const startedAt = useRef(0);
  const style = toneStyles[item.tone];
  const Icon = style.icon;

  const stopTimer = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);

  const startTimer = useCallback(() => {
    if (timer.current || remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onDismiss(item.id), remaining.current);
  }, [item.id, onDismiss]);

  useEffect(() => {
    startTimer();
    return stopTimer;
  }, [startTimer, stopTimer]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
      onFocus={stopTimer}
      onBlur={startTimer}
      className="pointer-events-auto relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_36px_-14px_rgba(15,23,42,0.35)] motion-safe:animate-[toast-in_180ms_ease-out]"
    >
      <div className="flex items-start gap-2.5 p-2.5 pr-9">
        <span className={`flex h-7 w-7 mt-1 shrink-0 items-center justify-center rounded-md ${style.iconClass}`}>
          <Icon aria-hidden="true" size={15} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] font-bold leading-4 text-slate-900">{item.message}</p>
          {item.description && <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{item.description}</p>}
        </div>
      </div>
      <button type="button" onClick={() => onDismiss(item.id)} className="absolute right-2 top-2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Dismiss notification">
        <X aria-hidden="true" size={13} />
      </button>
      <span className={`absolute inset-x-0 bottom-0 h-0.5 ${style.barClass}`} />
    </div>
  );
}
