'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  Building2,
  CircleDollarSign,
  FilePlus2,
  Files,
  Factory,
  Landmark,
  LayoutDashboard,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

type CommandGroup = 'Create' | 'Navigate' | 'Manage';

type Command = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: CommandGroup;
  keywords?: string;
};

const COMMANDS: Command[] = [
  {
    href: '/invoices/new',
    label: 'Create Invoice',
    description: 'Create a new customer sales invoice',
    icon: FilePlus2,
    group: 'Create',
    keywords: 'new bill sale',
  },
  {
    href: '/sales/payment-in',
    label: 'Payment In',
    description: 'Record money received from customers',
    icon: ArrowDownToLine,
    group: 'Create',
    keywords: 'receipt collection',
  },
  {
    href: '/purchases/payment-out',
    label: 'Payment Out',
    description: 'Record outgoing business payments',
    icon: ArrowUpFromLine,
    group: 'Create',
    keywords: 'expense supplier',
  },

  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'View your complete business overview',
    icon: LayoutDashboard,
    group: 'Navigate',
  },
  {
    href: '/parties',
    label: 'Parties',
    description: 'Manage customers and suppliers',
    icon: Users,
    group: 'Navigate',
  },
  {
    href: '/items',
    label: 'Items',
    description: 'Products, services and inventory',
    icon: Package,
    group: 'Navigate',
    keywords: 'inventory stock',
  },
  {
    href: '/sales',
    label: 'Sales',
    description: 'Invoices, estimates and sales orders',
    icon: CircleDollarSign,
    group: 'Navigate',
  },
  {
    href: '/purchases',
    label: 'Purchases',
    description: 'Bills, expenses and purchase orders',
    icon: ShoppingCart,
    group: 'Navigate',
  },
  {
    href: '/documents',
    label: 'Documents',
    description: 'Quotes, returns and delivery challans',
    icon: Files,
    group: 'Navigate',
  },
  {
    href: '/cash-banks',
    label: 'Cash & Banks',
    description: 'Manage accounts and payment details',
    icon: Landmark,
    group: 'Navigate',
  },
  {
    href: '/production',
    label: 'Production',
    description: 'Track garment production workflow',
    icon: Factory,
    group: 'Navigate',
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'Sales, finance and inventory insights',
    icon: BarChart3,
    group: 'Navigate',
  },

  {
    href: '/businesses',
    label: 'Companies & Branches',
    description: 'Choose and manage business workspaces',
    icon: Building2,
    group: 'Manage',
    keywords: 'business branch company',
  },
  {
    href: '/team',
    label: 'Team',
    description: 'Members, roles and permissions',
    icon: Users,
    group: 'Manage',
  },
  {
    href: '/security',
    label: 'Security',
    description: 'Account security and MFA protection',
    icon: ShieldCheck,
    group: 'Manage',
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Configure business preferences',
    icon: Settings,
    group: 'Manage',
  },
];

const GROUP_INFO: Record<
  CommandGroup,
  {
    title: string;
    subtitle: string;
  }
> = {
  Create: {
    title: 'Quick Create',
    subtitle: 'Start a transaction',
  },
  Navigate: {
    title: 'Business',
    subtitle: 'Open a module',
  },
  Manage: {
    title: 'Management',
    subtitle: 'Workspace settings',
  },
};

export default function CommandMenu({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const searchId = useId();
  const listId = useId();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setQuery('');
    setActiveIndex(0);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return COMMANDS;

    return COMMANDS.filter(
      ({ label, description, keywords, group }) =>
        `${label} ${description} ${keywords ?? ''} ${group}`
          .toLowerCase()
          .includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const activeOption =
      listRef.current?.querySelector<HTMLElement>(
        `[data-command-index="${activeIndex}"]`,
      );

    activeOption?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeIndex]);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');

    if (href !== pathname) {
      router.push(href);
    }
  }

  const grouped = useMemo(
    () =>
      (['Create', 'Navigate', 'Manage'] as CommandGroup[])
        .map((group) => ({
          group,
          commands: results.filter(
            (command) => command.group === group,
          ),
        }))
        .filter(({ commands }) => commands.length > 0),
    [results],
  );

  return (
    <div ref={containerRef} className={compact ? 'relative' : 'relative w-full max-w-[340px]'}>
      {compact && !open ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="Search menu" aria-keyshortcuts="Control+K Meta+K" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Search aria-hidden="true" size={18} />
        </button>
      ) : (
        <div className={compact ? 'absolute right-0 top-0 z-50 w-[min(360px,calc(100vw-24px))]' : 'relative'}>
          <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            id={searchId}
            role="combobox"
            aria-label="Search pages and actions"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={open && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => results.length ? (index + 1) % results.length : 0);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => results.length ? (index - 1 + results.length) % results.length : 0);
              } else if (event.key === 'Enter' && open && results[activeIndex]) {
                event.preventDefault();
                navigate(results[activeIndex].href);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder="Search pages and actions..."
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {compact && <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Esc</button>}
        </div>
      )}
      {open && (
        <div ref={listRef} id={listId} role="listbox" aria-label="Navigation results" className={`scrollbar-hide absolute top-full z-50 mt-2 max-h-[min(70vh,460px)] w-[min(420px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${compact ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No matching action</p>
          ) : grouped.map(({ group, commands }) => (
            <div key={group}>
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{GROUP_INFO[group].title}</p>
              {commands.map((command) => {
                const index = results.indexOf(command);
                const Icon = command.icon;
                return (
                  <button key={command.href} id={`${listId}-${index}`} data-command-index={index} type="button" role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => navigate(command.href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none ${index === activeIndex ? 'bg-blue-50' : ''}`}>
                    <Icon aria-hidden="true" size={17} className="shrink-0 text-blue-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{command.label}</span>
                      <span className="block truncate text-xs text-slate-500">{command.description}</span>
                    </span>
                    {pathname === command.href && <span className="text-[10px] font-semibold text-blue-600">Current</span>}
                    <ArrowRight aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
