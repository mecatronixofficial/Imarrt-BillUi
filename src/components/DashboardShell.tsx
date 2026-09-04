'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, PanelLeftOpen, Plus, ReceiptText } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';
import type { SessionUser } from '@/lib/api';
import Sidebar from './Sidebar';
import CommandMenu from './CommandMenu';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  parties: 'Parties',
  items: 'Items',
  invoices: 'Invoices',
  sales: 'Sales',
  purchases: 'Purchases',
  documents: 'Documents',
  production: 'Production',
  reports: 'Reports',
  settings: 'Settings',
  security: 'Security',
  team: 'Team',
  businesses: 'Businesses',
  'cash-banks': 'Cash & Banks',
};

export default function DashboardShell({ children, contentClassName = '' }: { children: React.ReactNode; contentClassName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const pageTitle = useMemo(() => {
    const section = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
    return PAGE_TITLES[section] ?? section.replaceAll('-', ' ');
  }, [pathname]);

  useEffect(() => {
    setSidebarHidden(localStorage.getItem('sidebarHidden') === 'true');
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        if (!currentUser) {
          router.replace('/login');
          return;
        }
        if (currentUser.mfaEnabled && !currentUser.mfaVerified && pathname !== '/security') {
          router.replace('/security');
          return;
        }
        setUser(currentUser);
        setChecked(true);
      })
      .catch(() => {
        if (active) router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const hideSidebar = useCallback(() => {
    setSidebarHidden(true);
    localStorage.setItem('sidebarHidden', 'true');
  }, []);
  const showSidebar = useCallback(() => {
    setSidebarHidden(false);
    localStorage.setItem('sidebarHidden', 'false');
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-screen min-h-dvh items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-label="Loading" />
      </div>
    );
  }

  const initials = user?.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="flex min-h-screen min-h-dvh bg-slate-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <button
        type="button"
        className={`fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm transition-opacity lg:hidden ${menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeMenu}
        aria-label="Close navigation overlay"
        tabIndex={menuOpen ? 0 : -1}
      />

      <Sidebar open={menuOpen} onClose={closeMenu} onHide={hideSidebar} desktopHidden={sidebarHidden} role={user?.role ?? null} />

      {sidebarHidden && (
        <button
          type="button"
          onClick={showSidebar}
          className="fixed left-0 top-1/2 z-40 hidden h-11 w-9 -translate-y-1/2 items-center justify-center rounded-r-xl bg-slate-950 text-slate-300 shadow-lg transition hover:w-10 hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:flex"
          aria-label="Show sidebar"
          title="Show sidebar"
        >
          <PanelLeftOpen aria-hidden="true" size={18} />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-5 lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-200">
              <ReceiptText aria-hidden="true" size={17} />
            </span>
            <span className="text-sm font-extrabold tracking-tight text-slate-900">iMart Billing</span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <Menu aria-hidden="true" size={20} />
          </button>
        </header>

        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-5 border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-xl lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold capitalize text-slate-900">{pageTitle}</p>
            <p className="text-[10px] font-medium text-slate-400">iMart workspace</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <CommandMenu />
            <Link href="/invoices/new" className="btn-primary inline-flex h-9 shrink-0 items-center gap-2 px-3 text-xs">
              <Plus aria-hidden="true" size={15} />
              <span className="hidden xl:inline">New invoice</span>
            </Link>
            <div className="flex min-w-0 items-center gap-2 border-l border-slate-200 pl-3" title={user?.email}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{initials}</span>
              <span className="hidden min-w-0 2xl:block">
                <span className="block max-w-32 truncate text-xs font-semibold text-slate-700">{user?.name}</span>
                <span className="block text-[10px] text-slate-400">{user?.role.toLowerCase().replace('_', ' ')}</span>
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={`mx-auto w-full max-w-[1440px] p-4 sm:p-5 lg:p-6 xl:p-8 ${contentClassName}`}>{children}</main>
      </div>
    </div>
  );
}
