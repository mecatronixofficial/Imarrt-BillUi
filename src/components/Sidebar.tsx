'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  BarChart3,
  Building2,
  Check,
  CircleDollarSign,
  Factory,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import {
  api,
  clearActiveBusiness,
  getAllPages,
  getActiveBranchId,
  getActiveBusinessId,
  resetSession,
  setActiveBusinessId,
  setActiveBranchId,
} from '@/lib/api';
import type { Branch, Business, Role } from '@/types';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{ href: string; label: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/parties', label: 'Parties', icon: Users },
  { href: '/items', label: 'Items', icon: Package },
  {
    href: '/sales',
    label: 'Sale',
    icon: CircleDollarSign,
    children: [
      { href: '/invoices', label: 'Sale Invoices' },
      { href: '/sales/quotations', label: 'Estimate / Quotation' },
      { href: '/sales/proforma', label: 'Proforma Invoice' },
      { href: '/sales/payment-in', label: 'Payment-In' },
      { href: '/sales/orders', label: 'Sale Order' },
      { href: '/sales/delivery-challans', label: 'Delivery Challan' },
      { href: '/sales/returns', label: 'Sale Return / Credit Note' },
    ],
  },
  { href: '/documents', label: 'Business Documents', icon: FileText },
  {
    href: '/purchases',
    label: 'Purchase & Expense',
    icon: ShoppingCart,
    children: [
      { href: '/purchases/bills', label: 'Purchase Bills' },
      { href: '/purchases/payment-out', label: 'Payment-Out' },
      { href: '/purchases/expenses', label: 'Expenses' },
      { href: '/purchases/orders', label: 'Purchase Order' },
      { href: '/purchases/returns', label: 'Purchase Return / Dr. Note' },
    ],
  },
  { href: '/cash-banks', label: 'Cash & Banks', icon: Landmark },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { href: '/settings/general', label: 'General' },
      { href: '/settings/transaction', label: 'Transaction' },
      { href: '/settings/print', label: 'Print' },
      { href: '/settings/taxes-gst', label: 'Taxes & GST' },
      { href: '/settings/transaction-message', label: 'Transaction Message' },
      { href: '/settings/party', label: 'Party' },
      { href: '/settings/item', label: 'Item' },
    ],
  },
  { href: '/security', label: 'Security', icon: ShieldCheck },
  { href: '/production', label: 'Production', icon: Factory },
  { href: '/businesses', label: 'Business', icon: Building2 },
];

const OWNER_NAV_ITEMS: NavItem[] = [
  { href: '/team', label: 'Team', icon: UserCog },
];

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
  onHide?: () => void;
  desktopHidden?: boolean;
  role: Role | null;
};

export default function Sidebar({ open = false, onClose, onHide, desktopHidden = false, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const businessMenuRef = useRef<HTMLDivElement>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBusinessId, setSelectedBusinessId] = useState('');
  const [activeBranchId, setSelectedBranchId] = useState('');
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebarCollapsed') === 'true');
  }, []);

  useEffect(() => {
    onClose?.();
    setBusinessMenuOpen(false);
    setOpenGroups((current) => ({
      ...current,
      '/sales': current['/sales'] || pathname?.startsWith('/sales') || pathname?.startsWith('/invoices') || false,
      '/purchases': current['/purchases'] || pathname?.startsWith('/purchases') || false,
      '/settings': current['/settings'] || pathname?.startsWith('/settings') || false,
    }));
  }, [pathname, onClose]);

  useEffect(() => {
    if (!businessMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!businessMenuRef.current?.contains(event.target as Node)) setBusinessMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setBusinessMenuOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [businessMenuOpen]);

  useEffect(() => {
    let active = true;
    void getAllPages<Business>('/businesses').then(async ({ data }) => {
      if (!active) return;
      setBusinesses(data);
      const stored = getActiveBusinessId();
      const selected = data.some(({ id }) => id === stored) ? stored! : data[0]?.id ?? '';
      if (selected) setActiveBusinessId(selected);
      setSelectedBusinessId(selected);
      if (!selected) return;

      const { data: availableBranches } = await getAllPages<Branch>('/branches');
      if (!active) return;
      setBranches(availableBranches);
      const storedBranch = getActiveBranchId(selected);
      const branchSelected = storedBranch === 'all' || availableBranches.some(({ id, isActive }) => isActive && id === storedBranch)
        ? storedBranch!
        : availableBranches.find(({ isActive }) => isActive)?.id ?? '';
      if (branchSelected) setActiveBranchId(branchSelected, selected);
      setSelectedBranchId(branchSelected);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const canManageTeam = role === 'OWNER' || role === 'SUPER_ADMIN';
  const navItems = NAV_ITEMS.flatMap((item) => {
    if (item.href === '/security' && canManageTeam) return [...OWNER_NAV_ITEMS, item];
    return [item];
  });
  const roleLabel = role === 'SUPER_ADMIN' ? 'Super admin' : role ? role.charAt(0) + role.slice(1).toLowerCase() : 'Member';
  const activeBusiness = businesses.find(({ id }) => id === activeBusinessId) ?? businesses[0];
  const activeBranch = branches.find(({ id }) => id === activeBranchId);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearActiveBusiness();
      resetSession();
      router.replace('/login');
      router.refresh();
    }
  }

  function handleBusinessChange(businessId: string) {
    if (!businessId || businessId === activeBusinessId) return;
    setActiveBusinessId(businessId);
    setSelectedBusinessId(businessId);
    window.location.href = '/dashboard';
  }

  function handleBranchChange(branchId: string) {
    if (!branchId || branchId === activeBranchId) return;
    setActiveBranchId(branchId, activeBusinessId);
    setSelectedBranchId(branchId);
    window.location.href = '/dashboard';
  }

  function updateCollapsed(next: boolean) {
    setCollapsed(next);
    setBusinessMenuOpen(false);
    localStorage.setItem('sidebarCollapsed', String(next));
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-50 flex h-screen h-dvh w-64 shrink-0 flex-col overflow-hidden bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-out',
        'lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:shadow-none',
        collapsed ? 'lg:w-[72px]' : 'lg:w-[252px]',
        desktopHidden && 'lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      aria-label="Main navigation"
    >
      <header className={clsx('relative flex h-16 shrink-0 items-center justify-between px-4 transition-all', collapsed && 'lg:h-24 lg:flex-col lg:justify-center lg:gap-2 lg:px-2 lg:py-2')}>
        <button type="button" onClick={() => {
          if (window.matchMedia('(min-width: 1024px)').matches) updateCollapsed(!collapsed);
          else { onClose?.(); router.push('/dashboard'); }
        }} className="flex items-center gap-2.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label={collapsed ? 'Expand sidebar' : 'Minimize sidebar'} title={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}>
          <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-950/50', collapsed && 'lg:h-8 lg:w-8')}>
            <ReceiptText aria-hidden="true" size={19} strokeWidth={2.4} />
          </span>
          <span className={collapsed ? 'lg:hidden' : ''}>
            <span className="block text-sm font-extrabold tracking-tight">iMart Billing</span>
            <span className="block text-[8px] font-semibold uppercase tracking-[0.17em] text-blue-300">Business made simple</span>
          </span>
        </button>
        <div className={clsx('hidden items-center lg:flex', collapsed && 'gap-1')}>
          <button type="button" onClick={onHide} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Hide sidebar" title="Hide sidebar">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
          aria-label="Close navigation"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </header>

      <div className={clsx('relative px-3 pb-2 transition-all', collapsed && 'lg:px-2')}>
        {activeBusiness ? (
          <div ref={businessMenuRef} className="relative z-30">
            <button
              type="button"
              id="active-business"
              aria-label="Change company or branch"
              aria-haspopup="listbox"
              aria-expanded={businessMenuOpen}
              onClick={() => collapsed ? updateCollapsed(false) : setBusinessMenuOpen((current) => !current)}
              title={collapsed ? activeBusiness.name : undefined}
              className={clsx('group flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 text-left outline-none transition hover:bg-blue-500/15 focus:ring-2 focus:ring-blue-500/50', collapsed && 'lg:justify-center lg:gap-0 lg:px-1')}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                <Building2 aria-hidden="true" size={15} />
              </span>
              <span className={clsx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
                <span className="block truncate text-xs font-semibold text-white">{activeBusiness.name}</span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-medium uppercase tracking-wider text-slate-400">
                  <MapPin aria-hidden="true" size={9} /> {activeBranchId === 'all' ? 'All branches' : activeBranch?.name ?? 'Select branch'}
                </span>
              </span>
              <ChevronDown aria-hidden="true" size={15} className={clsx('shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-white', businessMenuOpen && 'rotate-180', collapsed && 'lg:hidden')} />
            </button>

            <div
              role="listbox"
              aria-label="Company and branch"
              className={`absolute left-0 right-0 top-full mt-2 origin-top overflow-hidden rounded-lg border border-white/10 bg-slate-900 p-1.5 shadow-2xl shadow-black/50 ring-1 ring-black/20 transition-all duration-150 ${businessMenuOpen ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-1 scale-[0.98] opacity-0'} ${collapsed ? 'lg:hidden' : ''}`}
            >
              <p className="px-2.5 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Switch business</p>
              <div className="max-h-52 space-y-1 overflow-y-auto [scrollbar-width:thin]">
                {businesses.map((business) => {
                  const selected = business.id === activeBusiness.id;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      key={business.id}
                      onClick={() => handleBusinessChange(business.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition focus:ring-2 focus:ring-blue-500 ${selected ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${selected ? 'bg-white/15' : 'bg-white/[0.05] text-blue-300'}`}>
                        <Building2 aria-hidden="true" size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{business.name}</span>
                      {selected && <Check aria-hidden="true" size={15} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 border-t border-white/10 pt-1">
                <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">View branch</p>
                <button
                  type="button"
                  onClick={() => handleBranchChange('all')}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition focus:ring-2 focus:ring-blue-500 ${activeBranchId === 'all' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.08]"><Building2 aria-hidden="true" size={14} /></span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">All branches</span>
                  {activeBranchId === 'all' && <Check aria-hidden="true" size={15} />}
                </button>
                {branches.filter(({ isActive }) => isActive).map((branch) => {
                  const selected = branch.id === activeBranchId;
                  return (
                    <button
                      type="button"
                      key={branch.id}
                      onClick={() => handleBranchChange(branch.id)}
                      className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition focus:ring-2 focus:ring-blue-500 ${selected ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.08]"><MapPin aria-hidden="true" size={14} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{branch.name}</span><span className="block text-[9px] uppercase text-slate-400">{branch.code}</span></span>
                      {selected && <Check aria-hidden="true" size={15} />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 border-t border-white/10 pt-1">
                <Link href="/businesses" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/10 hover:text-blue-200">
                  Manage company & branches <ChevronRight aria-hidden="true" size={14} />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <Link href="/businesses" title={collapsed ? 'Add your first business' : undefined} className={clsx('flex h-9 items-center gap-2 rounded-lg border border-dashed border-blue-400/30 bg-blue-500/10 px-2.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/15', collapsed && 'lg:justify-center lg:gap-0 lg:px-1')}>
            <Building2 aria-hidden="true" size={15} /> <span className={collapsed ? 'lg:hidden' : ''}>Add your first business</span>
          </Link>
        )}
      </div>

      <nav className={clsx('relative min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-color:rgba(148,163,184,0.25)_transparent] [scrollbar-width:thin]', collapsed && 'lg:px-2')}>
        <div className="space-y-1.5">
          {navItems.map(({ href, label, icon: Icon, children }) => {
            const active = href === '/dashboard'
              ? pathname === href
              : Boolean(pathname?.startsWith(href) || children?.some((child) => pathname === child.href || pathname?.startsWith(`${child.href}/`)));

            if (children?.length) {
              const groupOpen = openGroups[href] ?? false;
              const setGroupOpen = (next: boolean | ((current: boolean) => boolean)) => {
                setOpenGroups((current) => ({
                  ...current,
                  [href]: typeof next === 'function' ? next(current[href] ?? false) : next,
                }));
              };
              return (
                <div key={href}>
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        updateCollapsed(false);
                        setGroupOpen(true);
                      } else {
                        setGroupOpen((current) => !current);
                      }
                    }}
                    title={collapsed ? label : undefined}
                    aria-expanded={groupOpen}
                    className={clsx(
                      'group relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-left outline-none transition-all focus:ring-2 focus:ring-blue-500',
                      collapsed && 'lg:justify-center lg:gap-0 lg:px-2',
                      active ? 'bg-blue-600 text-white shadow-md shadow-blue-950/25' : 'text-slate-200 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center', active ? 'text-white' : 'text-slate-300 group-hover:text-white')}><Icon aria-hidden="true" size={17} /></span>
                    <span className={clsx('min-w-0 flex-1 truncate text-[14px] font-medium', collapsed && 'lg:hidden')}>{label}</span>
                    <ChevronDown aria-hidden="true" size={15} className={clsx('transition-transform', groupOpen && 'rotate-180', collapsed && 'lg:hidden')} />
                  </button>
                  <div className={clsx('grid transition-[grid-template-rows,opacity] duration-200', groupOpen && !collapsed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                    <div className="overflow-hidden">
                      <div className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                        {children.map((child) => {
                          const childActive = pathname === child.href || pathname?.startsWith(`${child.href}/`);
                          return <Link key={child.href} href={child.href} aria-current={childActive ? 'page' : undefined} className={clsx('flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold transition', childActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200')}><span className={clsx('mr-2 h-1.5 w-1.5 shrink-0 rounded-full', childActive ? 'bg-blue-300' : 'bg-slate-600')} />{child.label}</Link>;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'group relative flex h-11 items-center gap-3 rounded-md px-3 outline-none transition-all focus:ring-2 focus:ring-blue-500',
                  collapsed && 'lg:justify-center lg:gap-0 lg:px-2',
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-950/25'
                    : 'text-slate-200 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center transition-colors',
                    active ? 'text-white' : 'text-slate-300 group-hover:text-white',
                  )}
                >
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className={clsx('min-w-0 flex-1 truncate text-[14px] font-medium', collapsed && 'lg:hidden')}>{label}</span>
                <ChevronRight
                  aria-hidden="true"
                  size={15}
                  className={clsx('transition-all', active ? 'opacity-100' : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-70', collapsed && 'lg:hidden')}
                />
              </Link>
            );
          })}
        </div>
      </nav>

      <footer className={clsx('relative shrink-0 border-t border-white/10 p-3', collapsed && 'lg:p-2')}>
        <div className={clsx('mb-1 flex items-center gap-2.5 rounded-md bg-white/[0.05] px-3 py-2.5', collapsed && 'lg:justify-center lg:gap-0 lg:px-1')} title={collapsed ? `Secure account · ${roleLabel}` : undefined}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
            <ShieldCheck aria-hidden="true" size={16} />
          </span>
          <span className={clsx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <span className="block text-[11px] font-semibold text-slate-200">Secure account</span>
            <span className="block text-[10px] text-slate-500">{roleLabel}</span>
          </span>
          <span className={clsx('h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]', collapsed && 'lg:hidden')} aria-label="Online" />
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          title={collapsed ? 'Log out' : undefined}
          className={clsx('group flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-slate-400 outline-none transition hover:bg-red-500/10 hover:text-red-300 focus:ring-2 focus:ring-red-400', collapsed && 'lg:justify-center lg:gap-0 lg:px-1')}
        >
          <span className="flex h-7 w-8 items-center justify-center rounded-md bg-white/[0.05] transition group-hover:bg-red-500/10">
            <LogOut aria-hidden="true" size={16} />
          </span>
          <span className={collapsed ? 'lg:hidden' : ''}>Log out</span>
        </button>
      </footer>
    </aside>
  );
}
