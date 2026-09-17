'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Menu, PanelLeftOpen, Plus, ReceiptText } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';
import type { SessionUser } from '@/lib/api';
import Sidebar from './Sidebar';
import CommandMenu from './CommandMenu';
import CompanyCornerPicker from './CompanyCornerPicker';

const PAGE_META: Record<string, { title: string; section: string }> = {
  '/dashboard': { title: 'Dashboard', section: 'Overview' },
  '/parties': { title: 'Parties', section: 'Sales' },
  '/items': { title: 'Items', section: 'Inventory' },
  '/invoices/new': { title: 'New invoice', section: 'Sales' },
  '/invoices': { title: 'Invoices', section: 'Sales' },
  '/sales/payment-in': { title: 'Payment in', section: 'Sales' },
  '/sales': { title: 'Sales', section: 'Sales' },
  '/purchases/payment-out': { title: 'Payment out', section: 'Purchases' },
  '/purchases': { title: 'Purchases', section: 'Purchases' },
  '/documents': { title: 'Documents', section: 'Transactions' },
  '/production': { title: 'Production', section: 'Operations' },
  '/reports': { title: 'Reports', section: 'Analytics' },
  '/settings': { title: 'Settings', section: 'Administration' },
  '/security': { title: 'Security', section: 'Administration' },
  '/team': { title: 'Team', section: 'Administration' },
  '/businesses': { title: 'Companies & branches', section: 'Workspace' },
  '/cash-banks': { title: 'Cash & Banks', section: 'Finance' },
};

export default function DashboardShell({ children, contentClassName = '' }: { children: React.ReactNode; contentClassName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const pageMeta = useMemo(() => {
    const match = Object.keys(PAGE_META).sort((a, b) => b.length - a.length).find((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (match) return PAGE_META[match];
    const section = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
    return { title: section.replaceAll('-', ' '), section: 'Workspace' };
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-xl sm:px-5 lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-200">
              <ReceiptText aria-hidden="true" size={17} />
            </span>
            <span className="hidden text-sm font-extrabold tracking-tight text-slate-900 min-[380px]:inline">iMart Billing</span>
          </div>
          <div className="flex items-center gap-2"><CommandMenu compact /><Link href="/invoices/new" className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700" aria-label="Create invoice"><Plus aria-hidden="true" size={17} /></Link><button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <Menu aria-hidden="true" size={20} />
          </button></div>
        </header>

        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-5 border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-xl lg:flex">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><span>{pageMeta.section}</span><ChevronRight aria-hidden="true" size={11} /><span className="truncate text-slate-500">{pageMeta.title}</span></div>
            <p className="mt-0.5 truncate text-sm font-extrabold capitalize text-slate-900">{pageMeta.title}</p>
          </div>
          <div className="absolute left-1/2 w-[340px] -translate-x-1/2"><CommandMenu /></div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <Link href="/invoices/new" className="btn-primary inline-flex h-9 shrink-0 items-center gap-2 px-3 text-xs">
              <Plus aria-hidden="true" size={15} />
              <span className="hidden xl:inline">New invoice</span>
            </Link>
            <div className="border-l border-slate-200 pl-3"><CompanyCornerPicker compact /></div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={`mx-auto w-full max-w-[1440px] p-4 sm:p-5 lg:p-6 xl:p-8 ${contentClassName}`}>{children}</main>
      </div>
    </div>
  );
}
