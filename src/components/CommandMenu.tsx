'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
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
import Modal from './Modal';

type CommandGroup = 'Create' | 'Navigate' | 'Manage';
type Command = { href: string; label: string; description: string; icon: LucideIcon; group: CommandGroup; keywords?: string };

const COMMANDS: Command[] = [
  { href: '/invoices/new', label: 'Create invoice', description: 'Start a new sales invoice', icon: FilePlus2, group: 'Create', keywords: 'new bill sale' },
  { href: '/sales/payment-in', label: 'Record payment in', description: 'Record money received', icon: ArrowDownToLine, group: 'Create', keywords: 'receipt collection' },
  { href: '/purchases/payment-out', label: 'Record payment out', description: 'Record money paid', icon: ArrowUpFromLine, group: 'Create', keywords: 'expense supplier' },
  { href: '/dashboard', label: 'Dashboard', description: 'Business overview', icon: LayoutDashboard, group: 'Navigate' },
  { href: '/parties', label: 'Parties', description: 'Customers and suppliers', icon: Users, group: 'Navigate' },
  { href: '/items', label: 'Items', description: 'Products, services and stock', icon: Package, group: 'Navigate', keywords: 'inventory' },
  { href: '/sales', label: 'Sales', description: 'Invoices, estimates and orders', icon: CircleDollarSign, group: 'Navigate' },
  { href: '/purchases', label: 'Purchases', description: 'Bills, expenses and orders', icon: ShoppingCart, group: 'Navigate' },
  { href: '/documents', label: 'Documents', description: 'Quotes, returns and challans', icon: Files, group: 'Navigate' },
  { href: '/cash-banks', label: 'Cash & Banks', description: 'Accounts and payment details', icon: Landmark, group: 'Navigate' },
  { href: '/production', label: 'Production', description: 'Garment production workflow', icon: Factory, group: 'Navigate' },
  { href: '/reports', label: 'Reports', description: 'Sales and inventory insights', icon: BarChart3, group: 'Navigate' },
  { href: '/businesses', label: 'Companies & branches', description: 'Choose your active workspace', icon: Building2, group: 'Manage', keywords: 'business branch company' },
  { href: '/team', label: 'Team', description: 'Members, roles and access', icon: Users, group: 'Manage' },
  { href: '/security', label: 'Security', description: 'Account and MFA protection', icon: ShieldCheck, group: 'Manage' },
  { href: '/settings', label: 'Settings', description: 'Business preferences', icon: Settings, group: 'Manage' },
];

export default function CommandMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COMMANDS;
    return COMMANDS.filter(({ label, description, keywords, group }) =>
      `${label} ${description} ${keywords ?? ''} ${group}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    const activeOption = listRef.current?.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    if (href !== pathname) router.push(href);
  }

  const grouped = useMemo(() => ['Create', 'Navigate', 'Manage'].map((group) => ({ group, commands: results.filter((command) => command.group === group) })).filter(({ commands }) => commands.length), [results]);

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" className={compact ? 'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500' : 'group flex h-9 w-full max-w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'} aria-label="Open quick navigation" title={compact ? 'Quick navigation (Ctrl K)' : undefined}>
      <Search aria-hidden="true" size={compact ? 17 : 15} className="shrink-0 text-slate-400 group-hover:text-blue-600" />
      {!compact && <><span className="flex-1">Search pages and actions</span><kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:inline">Ctrl K</kbd></>}
    </button>

    {open && <Modal title="Quick navigation" onClose={() => setOpen(false)} size="full" initialFocusRef={inputRef} className="flex flex-col overflow-hidden [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
      <label htmlFor={searchId} className="sr-only">Search pages and actions</label>
      <div className="relative mx-auto w-full max-w-3xl shrink-0"><Search aria-hidden="true" size={21} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input ref={inputRef} id={searchId} role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={listId} aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => results.length ? (index + 1) % results.length : 0); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => results.length ? (index - 1 + results.length) % results.length : 0); }
        if (event.key === 'Home') { event.preventDefault(); setActiveIndex(0); }
        if (event.key === 'End') { event.preventDefault(); setActiveIndex(Math.max(0, results.length - 1)); }
        if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); setQuery(''); }
        if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); navigate(results[activeIndex].href); }
      }} className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-20 text-base font-semibold text-slate-900 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Search pages or actions…" autoComplete="off" /><span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400 sm:block">↑↓ Enter</span></div>
      <p className="mx-auto mt-3 w-full max-w-3xl shrink-0 text-center text-xs text-slate-400">Search across pages, transactions, reports, and workspace settings</p>
      <div ref={listRef} id={listId} role="listbox" className="mt-5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4" aria-label="Navigation results">
        <div className="grid items-start gap-4 md:grid-cols-3">{grouped.map(({ group, commands }) => <section key={group} className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70"><p className="mb-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</p><div className="space-y-1">{commands.map((command) => {
          const index = results.indexOf(command); const Icon = command.icon; const selected = index === activeIndex; const current = pathname === command.href;
          return <button id={`${listId}-${index}`} data-command-index={index} role="option" aria-selected={selected} key={command.href} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => navigate(command.href)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><Icon aria-hidden="true" size={17} /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-slate-800">{command.label}{current && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] uppercase text-blue-600">Current</span>}</span><span className="block truncate text-xs text-slate-500">{command.description}</span></span></button>;
        })}</div></section>)}</div>
        {results.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center"><ReceiptText aria-hidden="true" size={22} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No matching page or action</p><p className="mt-1 text-xs text-slate-500">Try a different keyword.</p></div>}
      </div>
    </Modal>}
  </>;
}
