'use client';

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BarChart3,
  Building2,
  CircleDollarSign,
  CornerDownLeft,
  FilePlus2,
  Files,
  Factory,
  Landmark,
  LayoutDashboard,
  Loader2,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getActiveBusinessId, getAllPages } from '@/lib/api';
import { DOCUMENT_CONFIG } from '@/lib/documents';
import { formatCurrency } from '@/lib/format';
import type { BusinessDocument, Invoice, Item, Party } from '@/types';

type Result = { id: string; href: string; label: string; description: string; icon: LucideIcon; badge?: string; search: string };
type Section = { key: string; title: string; results: Result[] };

const page = (href: string, label: string, description: string, icon: LucideIcon, keywords = ''): Result => ({ id: `page:${href}`, href, label, description, icon, search: `${label} ${description} ${keywords}`.toLowerCase() });

const CREATE: Result[] = [
  page('/invoices/new', 'Create Invoice', 'Create a new customer sales invoice', FilePlus2, 'new bill sale'),
  page('/purchases/bills/new', 'Create Purchase Bill', 'Record a bill from a supplier', ShoppingCart, 'new supplier purchase'),
  page('/sales/quotations/new', 'Create Estimate', 'Send a quotation to a customer', FilePlus2, 'quote quotation new'),
  page('/sales/payment-in', 'Payment In', 'Record money received from customers', ArrowDownToLine, 'receipt collection'),
  page('/purchases/payment-out', 'Payment Out', 'Record outgoing business payments', ArrowUpFromLine, 'expense supplier'),
];

const NAVIGATE: Result[] = [
  page('/dashboard', 'Dashboard', 'View your complete business overview', LayoutDashboard, 'home'),
  page('/parties', 'Parties', 'Manage customers and suppliers', Users, 'customer supplier'),
  page('/items', 'Items', 'Products, services and inventory', Package, 'inventory stock product'),
  page('/sales', 'Sales', 'Invoices, estimates and sales orders', CircleDollarSign),
  page('/invoices', 'Sale Invoices', 'All customer invoices and balances', ReceiptText),
  page('/purchases', 'Purchases', 'Bills, expenses and purchase orders', ShoppingCart),
  page('/documents', 'Documents', 'Quotes, returns and delivery challans', Files, 'challan credit debit note'),
  page('/cash-banks', 'Cash & Banks', 'Manage accounts and payment details', Landmark),
  page('/production', 'Production', 'Track garment production workflow', Factory),
  page('/reports', 'Reports', 'Sales, finance and inventory insights', BarChart3),
];

const MANAGE: Result[] = [
  page('/businesses', 'Companies & Branches', 'Choose and manage business workspaces', Building2, 'business branch company'),
  page('/team', 'Team', 'Members, roles and permissions', Users),
  page('/security', 'Security', 'Account security and MFA protection', ShieldCheck, 'mfa password'),
  page('/settings', 'Settings', 'Configure business preferences', Settings),
];

const RECORD_LIMIT = 4;
const CACHE_MS = 60_000;

type Records = { invoices: Invoice[]; parties: Party[]; items: Item[]; documents: BusinessDocument[] };
const EMPTY_RECORDS: Records = { invoices: [], parties: [], items: [], documents: [] };
let recordsCache: { businessId: string | null; at: number; data: Records } | null = null;

/** Loads the records the search looks through, once per minute per company, and only when the menu is first used. */
function useRecords(active: boolean) {
  const [records, setRecords] = useState<Records>(EMPTY_RECORDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    const businessId = getActiveBusinessId();
    if (recordsCache && recordsCache.businessId === businessId && Date.now() - recordsCache.at < CACHE_MS) {
      setRecords(recordsCache.data);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled([
      getAllPages<Invoice>('/invoices'),
      getAllPages<Party>('/parties'),
      getAllPages<Item>('/items'),
      getAllPages<BusinessDocument>('/documents'),
    ]).then(([invoices, parties, items, documents]) => {
      if (cancelled) return;
      const data: Records = {
        invoices: invoices.status === 'fulfilled' ? invoices.value.data : [],
        parties: parties.status === 'fulfilled' ? parties.value.data : [],
        items: items.status === 'fulfilled' ? items.value.data : [],
        documents: documents.status === 'fulfilled' ? documents.value.data : [],
      };
      recordsCache = { businessId, at: Date.now(), data };
      setRecords(data);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  return { records, loading };
}

const matches = (haystack: string, tokens: string[]) => tokens.every((token) => haystack.includes(token));

function recordResults(records: Records, tokens: string[]): Section[] {
  const invoices = records.invoices
    .filter((invoice) => matches(`${invoice.invoiceNumber} ${invoice.party?.name ?? ''} ${invoice.status}`.toLowerCase(), tokens))
    .slice(0, RECORD_LIMIT)
    .map<Result>((invoice) => ({ id: `invoice:${invoice.id}`, href: `/invoices/${invoice.id}`, label: invoice.invoiceNumber, description: `${invoice.party?.name ?? 'Unknown party'} · ${formatCurrency(invoice.grandTotal)}`, icon: ReceiptText, badge: invoice.status.replaceAll('_', ' ').toLowerCase(), search: '' }));
  const parties = records.parties
    .filter((party) => matches(`${party.name} ${party.code ?? ''} ${party.phone ?? ''} ${party.email ?? ''}`.toLowerCase(), tokens))
    .slice(0, RECORD_LIMIT)
    .map<Result>((party) => ({ id: `party:${party.id}`, href: `/parties/${party.id}`, label: party.name, description: [party.phone, party.email].filter(Boolean).join(' · ') || 'Party', icon: UserRound, search: '' }));
  const items = records.items
    .filter((item) => matches(`${item.name} ${item.sku ?? ''}`.toLowerCase(), tokens))
    .slice(0, RECORD_LIMIT)
    .map<Result>((item) => ({ id: `item:${item.id}`, href: `/items/${item.id}`, label: item.name, description: `${item.sku ? `${item.sku} · ` : ''}${formatCurrency(item.salePrice)} · stock ${Number(item.stockQty)}`, icon: Package, search: '' }));
  const documents = records.documents
    .filter((document) => matches(`${document.documentNumber} ${document.party?.name ?? ''} ${document.supplier?.name ?? ''} ${DOCUMENT_CONFIG[document.type]?.label ?? ''}`.toLowerCase(), tokens))
    .slice(0, RECORD_LIMIT)
    .map<Result>((document) => ({ id: `document:${document.id}`, href: `/documents/${document.id}`, label: document.documentNumber, description: `${DOCUMENT_CONFIG[document.type]?.label ?? document.type} · ${document.party?.name ?? document.supplier?.name ?? 'No party'}`, icon: Files, badge: document.status.toLowerCase(), search: '' }));
  return [
    { key: 'invoices', title: 'Invoices', results: invoices },
    { key: 'parties', title: 'Parties', results: parties },
    { key: 'items', title: 'Items', results: items },
    { key: 'documents', title: 'Documents', results: documents },
  ];
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  return <>{text.split(pattern).map((part, index) => (index % 2 ? <mark key={index} className="rounded-sm bg-yellow-100 px-0.5 text-inherit">{part}</mark> : <Fragment key={index}>{part}</Fragment>))}</>;
}

export default function CommandMenu({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [used, setUsed] = useState(false);
  const { records, loading } = useRecords(used);

  const openMenu = useCallback(() => { setOpen(true); setUsed(true); }, []);
  const closeMenu = useCallback(() => { setOpen(false); setQuery(''); }, []);

  // Ctrl/Cmd+K opens the search from anywhere; "/" does too when you are not typing in a field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openMenu();
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        openMenu();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!compact && !containerRef.current?.contains(event.target as Node)) closeMenu();
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, compact, closeMenu]);

  // On phones the search is a full-screen sheet, so keep the page behind it from scrolling.
  useEffect(() => {
    if (!open || !compact) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open, compact]);

  const tokens = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);

  const sections = useMemo<Section[]>(() => {
    if (!tokens.length) {
      return [
        { key: 'create', title: 'Quick create', results: CREATE },
        { key: 'navigate', title: 'Go to', results: NAVIGATE },
        { key: 'manage', title: 'Management', results: MANAGE },
      ];
    }
    const pages = [...CREATE, ...NAVIGATE, ...MANAGE].filter((result) => matches(result.search, tokens)).slice(0, 6);
    return [{ key: 'pages', title: 'Pages & actions', results: pages }, ...recordResults(records, tokens)].filter(({ results }) => results.length > 0);
  }, [tokens, records]);

  const flat = useMemo(() => sections.flatMap(({ results }) => results), [sections]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function go(result: Result) {
    closeMenu();
    if (result.href !== pathname) router.push(result.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, flat.length - 1));
    } else if (event.key === 'Enter' && flat[activeIndex]) {
      event.preventDefault();
      go(flat[activeIndex]);
    }
  }

  const input = (
    <div className="relative min-w-0 flex-1">
      <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        role="combobox"
        aria-label="Search pages, records and actions"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={open && flat[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        value={query}
        onFocus={openMenu}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder="Search invoices, parties, items…"
        autoComplete="off"
        spellCheck={false}
        className={`h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100/70 ${compact ? 'pr-20' : 'pr-16'}`}
      />
      {query ? (
        <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search" className={`absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${compact ? 'right-10' : 'right-2.5'}`}>
          <X aria-hidden="true" size={14} />
        </button>
      ) : (
        <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 md:block">Ctrl K</kbd>
      )}
      {compact && (
        <button type="button" onClick={closeMenu} aria-label="Cancel search" title="Cancel search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );

  const list = open && (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label="Search results"
      className={compact
        ? 'fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto overscroll-contain bg-white p-2'
        : 'scrollbar-hide absolute left-1/2 top-full z-50 mt-2 max-h-[min(70vh,520px)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10'}
    >
      {flat.length === 0 ? (
        <div className="px-3 py-10 text-center">
          {loading ? <Loader2 aria-hidden="true" size={20} className="mx-auto animate-spin text-slate-400" /> : <Search aria-hidden="true" size={22} className="mx-auto text-slate-300" />}
          <p className="mt-2 text-sm font-semibold text-slate-700">{loading ? 'Searching your records…' : `Nothing found for “${query.trim()}”`}</p>
          {!loading && <p className="mt-0.5 text-xs text-slate-400">Try an invoice number, a party name, or an item SKU.</p>}
        </div>
      ) : sections.map(({ key, title, results }) => (
        <div key={key}>
          <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
          {results.map((result) => {
            const index = flat.indexOf(result);
            const Icon = result.icon;
            const active = index === activeIndex;
            return (
              <button
                key={result.id}
                id={`${listId}-${index}`}
                data-command-index={index}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(result)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left focus-visible:outline-none ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><Icon aria-hidden="true" size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900"><Highlight text={result.label} tokens={tokens} /></span>
                  <span className="block truncate text-xs text-slate-500"><Highlight text={result.description} tokens={tokens} /></span>
                </span>
                {result.badge && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold capitalize text-slate-500">{result.badge}</span>}
                {result.href === pathname && <span className="shrink-0 text-[10px] font-semibold text-blue-600">Current</span>}
                {active ? <CornerDownLeft aria-hidden="true" size={14} className="hidden shrink-0 text-blue-500 sm:block" /> : <ArrowRight aria-hidden="true" size={14} className="shrink-0 text-slate-300" />}
              </button>
            );
          })}
        </div>
      ))}
      {tokens.length > 0 && loading && flat.length > 0 && (
        <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400"><Loader2 aria-hidden="true" size={12} className="animate-spin" /> Still searching your records…</p>
      )}
    </div>
  );

  if (compact) {
    return (
      <div ref={containerRef}>
        <button type="button" onClick={openMenu} aria-label="Search" aria-keyshortcuts="Control+K Meta+K" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-blue-600 focus:outline-none">
          <Search aria-hidden="true" size={17} />
        </button>
        {/* Portalled: the sticky header uses backdrop blur, which would otherwise trap position:fixed inside it. */}
        {open && createPortal(
          <>
            <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-slate-200 bg-white px-3">
              {input}
            </div>
            {list}
          </>,
          document.body,
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex">{input}</div>
      {list}
    </div>
  );
}
