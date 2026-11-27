'use client';

/**
 * Centralized, history-based navigation.
 *
 * - `NavigationProvider` (mounted once in AppFrame) keeps a stack of the in-app pages visited in this tab,
 *   including their query strings (filters, search, page, tab) and scroll position. It survives a page
 *   refresh (sessionStorage) but starts fresh in a new tab or on direct URL access, so Back never leaves
 *   the app.
 * - `useBackNavigation()` goes to the page the user actually came from (browser history, so the URL,
 *   filters and scroll come back), or to a module-specific fallback when there is no previous page.
 * - `useUnsavedChanges(dirty)` / `useFormDirty()` protect forms: Back asks before discarding changes, and
 *   refreshing or closing the tab shows the browser's own warning.
 */

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

export const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Are you sure you want to leave this page?';

const STORAGE_KEY = 'imart:navigation';
const MAX_ENTRIES = 100;

/** Every page route in src/app (route groups removed). Fallbacks only ever point at one of these. */
const APP_ROUTES = [
  '/', '/businesses', '/cash-banks', '/cash-banks/cash', '/cash-banks/cheques', '/cash-banks/loans', '/customers', '/dashboard',
  '/documents', '/documents/[id]', '/documents/new', '/forgot-password', '/inventory', '/inventory/adjustments', '/inventory/godowns',
  '/invoices', '/invoices/[id]', '/invoices/new', '/items', '/items/[id]', '/login', '/parties', '/parties/[id]', '/parties/details',
  '/parties/groups', '/production', '/production/[id]', '/profile', '/purchases', '/purchases/bills', '/purchases/bills/new',
  '/purchases/expenses', '/purchases/orders', '/purchases/orders/[id]', '/purchases/orders/[id]/edit', '/purchases/orders/new',
  '/purchases/payment-out', '/purchases/returns', '/purchases/returns/new', '/purchases/suppliers', '/reports', '/reset-password',
  '/sales', '/sales/delivery-challans', '/sales/delivery-challans/new', '/sales/orders', '/sales/orders/new', '/sales/other-income',
  '/sales/payment-in', '/sales/proforma', '/sales/proforma/new', '/sales/quotations', '/sales/quotations/new', '/sales/returns',
  '/sales/returns/new', '/security', '/settings', '/settings/general', '/settings/item', '/settings/party', '/settings/passcode',
  '/settings/print', '/settings/taxes-gst', '/settings/transaction', '/settings/transaction-message', '/team',
];
const ROUTE_PATTERNS = APP_ROUTES.map((route) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`));
const isAppRoute = (path: string) => ROUTE_PATTERNS.some((pattern) => pattern.test(path));

/**
 * Where Back goes when there is no previous page (direct link, refresh in a new tab): the nearest existing
 * parent route of the module, e.g. /sales/quotations/new → /sales/quotations, /invoices/123 → /invoices,
 * /purchases/orders/1/edit → /purchases/orders/1, /settings/taxes-gst → /settings.
 */
export function fallbackRoute(pathname: string): string {
  if (pathname === '/forgot-password' || pathname === '/reset-password') return '/login';
  if (pathname === '/dashboard') return '/businesses';
  if (pathname.startsWith('/settings/')) return '/settings';
  const segments = pathname.split('/').filter(Boolean);
  for (let length = segments.length - 1; length > 0; length--) {
    const parent = `/${segments.slice(0, length).join('/')}`;
    if (isAppRoute(parent)) return parent;
  }
  return '/dashboard';
}

/** One visited page. `id` identifies this history slot, so page state saved for it comes back on Back/Forward. */
type Entry = { id: string; url: string; scrollY: number };
const newEntry = (url: string): Entry => ({ id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), url, scrollY: 0 });
type Stack = { entries: Entry[]; index: number };

/** Restores the stack only when this tab is reloaded or revisited; a new tab or typed URL starts fresh. */
function loadStack(): Stack {
  try {
    const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== 'reload' && navigation?.type !== 'back_forward') return { entries: [], index: -1 };
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Stack | null;
    if (!saved || !Array.isArray(saved.entries) || !Number.isInteger(saved.index)) return { entries: [], index: -1 };
    const entries = saved.entries.filter((entry) => typeof entry?.id === 'string' && typeof entry.url === 'string' && entry.url.startsWith('/') && !entry.url.startsWith('//')).slice(-MAX_ENTRIES);
    return { entries, index: Math.min(Math.max(saved.index, -1), entries.length - 1) };
  } catch {
    return { entries: [], index: -1 };
  }
}

const currentUrl = () => window.location.pathname + window.location.search;

/** Puts the page back where the user left it, waiting (up to ~2s) for data-driven content to grow tall enough. */
function restoreScroll(y: number) {
  if (y <= 0) return;
  let stopped = false;
  const stop = () => { stopped = true; };
  for (const type of ['wheel', 'touchstart', 'keydown', 'mousedown'] as const) window.addEventListener(type, stop, { once: true, passive: true });
  let frames = 0;
  const tick = () => {
    if (stopped) return;
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) < 2 || ++frames > 120) return;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

type NavigationApi = {
  /** URL of the in-app page before this one, or null when there is none in this tab. */
  previousUrl: () => string | null;
  /** Resolves true when it is fine to leave (no unsaved changes, or the user chose to discard them). */
  confirmLeave: () => Promise<boolean>;
  register: (id: symbol) => void;
  unregister: (id: symbol) => void;
  /** Id of the history entry being returned to by Back/Forward, while that page renders; otherwise null. */
  restoringEntryId: () => string | null;
  /** Id of the history entry of the page currently shown. */
  currentEntryId: () => string | null;
};

const NavigationContext = createContext<NavigationApi>({
  previousUrl: () => null,
  confirmLeave: () => Promise.resolve(true),
  register: () => undefined,
  unregister: () => undefined,
  restoringEntryId: () => null,
  currentEntryId: () => null,
});

const PAGE_STATE_PREFIX = 'imart:page-state:';

/** The entry a Back/Forward to `url` lands on: the neighbour first, else the latest entry with that URL. */
function findEntry(s: Stack, url: string) {
  if (s.entries[s.index - 1]?.url === url) return s.index - 1;
  if (s.entries[s.index + 1]?.url === url) return s.index + 1;
  return s.entries.map((entry) => entry.url).lastIndexOf(url);
}

/** Drops page state saved for history entries that no longer exist in this tab. */
function prunePageState(s: Stack) {
  try {
    const live = new Set(s.entries.map((entry) => entry.id));
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PAGE_STATE_PREFIX) && !live.has(key.slice(PAGE_STATE_PREFIX.length).split(':')[0])) sessionStorage.removeItem(key);
    }
  } catch { /* Storage unavailable. */ }
}

/** Reports every URL change, query-only changes included. Separate so useSearchParams sits in Suspense. */
function UrlWatcher({ onUrl }: { onUrl: (url: string) => void }) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => { onUrl(pathname + (search ? `?${search}` : '')); }, [onUrl, pathname, search]);
  return null;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const stack = useRef<Stack | null>(null);
  const historyLength = useRef(0);
  // Initialised during the first client render: the URL watcher's effect runs before this component's effects.
  if (stack.current === null && typeof window !== 'undefined') {
    stack.current = loadStack();
    historyLength.current = window.history.length;
  }
  const poppedUrl = useRef<string | null>(null);
  // Page state is only restored after hydration: restoring during it would not match the server-rendered HTML.
  const hydrated = useRef(false);
  const dirtySources = useRef(new Set<symbol>());
  const [pendingLeave, setPendingLeave] = useState<((leave: boolean) => void) | null>(null);

  const persist = useCallback(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.current)); } catch { /* Storage unavailable: history still works in memory. */ }
  }, []);

  useEffect(() => {
    hydrated.current = true;
    // Browser Back/Forward: remember which URL it landed on so the next URL change is treated as a move, not a new page.
    const onPop = () => { poppedUrl.current = currentUrl(); };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const s = stack.current;
        const entry = s?.entries[s.index];
        // Ignore the scroll reset of a page that is already replacing this one.
        if (entry && entry.url === currentUrl()) entry.scrollY = Math.round(window.scrollY);
      });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtySources.current.size) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', persist);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', persist);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [persist]);

  const record = useCallback((url: string) => {
    const s = stack.current ?? (stack.current = { entries: [], index: -1 });
    const here = s.entries[s.index]?.url;
    if (poppedUrl.current === url) {
      // Browser Back/Forward (or our own Back): move to the matching entry and restore its scroll.
      poppedUrl.current = null;
      const target = findEntry(s, url);
      if (target >= 0) {
        s.index = target;
        restoreScroll(s.entries[target].scrollY);
      } else {
        s.entries = [newEntry(url)];
        s.index = 0;
      }
    } else if (url !== here) {
      // A new history entry means a push; otherwise the app replaced the URL (redirect, filter update, save).
      const pushed = window.history.length > historyLength.current;
      if (pushed || s.index < 0) {
        s.entries = [...s.entries.slice(0, s.index + 1), newEntry(url)].slice(-MAX_ENTRIES);
        s.index = s.entries.length - 1;
        prunePageState(s);
      } else {
        // Same history slot: keep its id so state saved for the page survives a URL replace (e.g. filters in the URL).
        s.entries[s.index] = { ...s.entries[s.index], url, scrollY: 0 };
      }
    }
    historyLength.current = window.history.length;
    persist();
  }, [persist]);

  const api = useMemo<NavigationApi>(() => ({
    previousUrl: () => {
      const s = stack.current;
      if (!s || s.index < 1) return null;
      const previous = s.entries[s.index - 1]?.url;
      // A duplicate of the current page is not somewhere to go back to (prevents Back loops).
      return previous && previous !== s.entries[s.index]?.url ? previous : null;
    },
    confirmLeave: () => {
      if (!dirtySources.current.size) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        setPendingLeave(() => (leave: boolean) => {
          setPendingLeave(null);
          if (leave) dirtySources.current.clear();
          resolve(leave);
        });
      });
    },
    register: (id) => { dirtySources.current.add(id); },
    unregister: (id) => { dirtySources.current.delete(id); },
    restoringEntryId: () => {
      const s = stack.current;
      if (!s || !hydrated.current || poppedUrl.current !== currentUrl()) return null;
      const target = findEntry(s, poppedUrl.current);
      return target >= 0 ? s.entries[target].id : null;
    },
    currentEntryId: () => {
      const s = stack.current;
      const entry = s?.entries[s.index];
      return entry && entry.url === currentUrl() ? entry.id : null;
    },
  }), []);

  return (
    <NavigationContext.Provider value={api}>
      <Suspense fallback={null}><UrlWatcher onUrl={record} /></Suspense>
      {children}
      {pendingLeave && (
        <ConfirmDialog
          title="Unsaved changes"
          message={UNSAVED_CHANGES_MESSAGE}
          cancelLabel="Stay on Page"
          confirmLabel="Discard Changes & Go Back"
          onCancel={() => pendingLeave(false)}
          onConfirm={() => pendingLeave(true)}
        />
      )}
    </NavigationContext.Provider>
  );
}

/**
 * Back to the page the user came from. Uses browser history (so query strings, filters, pagination, tabs
 * and scroll come back) when there is an in-app previous page; otherwise replaces the URL with the
 * module fallback, so there is never a loop or a jump outside the app. Asks first when a form is dirty.
 */
export function useBackNavigation(fallback?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const { previousUrl, confirmLeave } = useContext(NavigationContext);
  const goBack = useCallback(async () => {
    if (!(await confirmLeave())) return;
    if (previousUrl()) {
      router.back();
      return;
    }
    const target = fallback ?? fallbackRoute(pathname);
    router.replace(target === pathname ? '/dashboard' : target);
  }, [confirmLeave, fallback, pathname, previousUrl, router]);
  return { goBack, confirmLeave };
}

/** Marks this page as having unsaved changes while `dirty` is true. Returns `confirmLeave` for custom close buttons. */
export function useUnsavedChanges(dirty: boolean) {
  const { register, unregister, confirmLeave } = useContext(NavigationContext);
  useEffect(() => {
    if (!dirty) return;
    const id = Symbol('unsaved-form');
    register(id);
    return () => unregister(id);
  }, [dirty, register, unregister]);
  return confirmLeave;
}

/**
 * Compares a form's current values with the values it had once it finished loading (new blank form, or the
 * record being edited). Auto-filled values that settle right after loading are part of the baseline.
 */
export function useFormDirty(value: unknown, ready: boolean) {
  const serialized = JSON.stringify(value);
  const latest = useRef(serialized);
  latest.current = serialized;
  const [baseline, setBaseline] = useState<string | null>(null);
  const captured = useRef(false);
  useEffect(() => {
    if (!ready || captured.current) return;
    const timer = window.setTimeout(() => { captured.current = true; setBaseline(latest.current); }, 400);
    return () => window.clearTimeout(timer);
  }, [ready]);
  return baseline !== null && baseline !== serialized;
}

/**
 * `useState` that remembers its value for this page's history entry: going Back/Forward to the page brings
 * back its search text, filters, tab, sort or date range; opening the page fresh (sidebar, link) starts from
 * `initial`. Values must be JSON-serialisable. Use a key that is unique within the page.
 */
export function usePageState<T>(key: string, initial: T | (() => T)) {
  const { restoringEntryId, currentEntryId } = useContext(NavigationContext);
  const [value, setValue] = useState<T>(() => {
    const id = typeof window === 'undefined' ? null : restoringEntryId();
    if (id) {
      try {
        const saved = sessionStorage.getItem(`${PAGE_STATE_PREFIX}${id}:${window.location.pathname}:${key}`);
        if (saved !== null) return JSON.parse(saved) as T;
      } catch { /* Fall back to the initial value. */ }
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    const id = currentEntryId();
    if (!id) return;
    try { sessionStorage.setItem(`${PAGE_STATE_PREFIX}${id}:${window.location.pathname}:${key}`, JSON.stringify(value)); } catch { /* Storage full or unavailable. */ }
  }, [currentEntryId, key, value]);
  return [value, setValue] as const;
}
