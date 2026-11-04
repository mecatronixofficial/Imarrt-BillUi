'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const PreviousPage = createContext<{ previous: string | null; reset: () => void }>({ previous: null, reset: () => undefined });

/** Track only pages visited inside this app, so direct links never navigate off-site. */
export function NavigationHistory({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const visited = useRef<string[]>([]);
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    const current = pathname + window.location.search;
    const pages = visited.current;
    if (pages.at(-1) !== current) {
      if (pages.at(-2) === current) pages.pop();
      else pages.push(current);
      if (pages.length > 100) pages.shift();
    }
    setPrevious(pages.at(-2) ?? null);
  }, [pathname]);

  return <PreviousPage.Provider value={{ previous, reset: () => { visited.current = []; setPrevious(null); } }}>{children}</PreviousPage.Provider>;
}

export function parentPage(pathname: string): string {
  if (pathname === '/dashboard') return '/businesses';
  if (pathname.startsWith('/settings/')) return '/settings';
  if (pathname === '/forgot-password' || pathname === '/reset-password') return '/login';
  const segments = pathname.split('/').filter(Boolean);
  return segments.length > 1 ? '/' + segments.slice(0, -1).join('/') : '/dashboard';
}

export default function BackButton({ fallback, className = '' }: { fallback?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { previous, reset } = useContext(PreviousPage);

  return (
    <button
      type="button"
      className={`brand-back ${className}`}
      aria-label="Go back"
      onClick={() => {
        if (previous && window.history.length > 1) router.back();
        else { reset(); router.replace(fallback ?? parentPage(pathname)); }
      }}
    >
      <ArrowLeft size={17} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
