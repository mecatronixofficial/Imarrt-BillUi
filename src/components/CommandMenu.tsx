'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  FilePlus2,
  Factory,
  Landmark,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Modal from './Modal';

type Command = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords?: string;
};

const COMMANDS: Command[] = [
  { href: '/dashboard', label: 'Dashboard', description: 'Business overview', icon: LayoutDashboard },
  { href: '/invoices/new', label: 'Create invoice', description: 'Start a new sale invoice', icon: FilePlus2, keywords: 'new bill sale' },
  { href: '/parties', label: 'Parties', description: 'Customers and suppliers', icon: Users },
  { href: '/items', label: 'Items', description: 'Products, services and stock', icon: Package, keywords: 'inventory' },
  { href: '/sales', label: 'Sales', description: 'Invoices, estimates and orders', icon: CircleDollarSign },
  { href: '/purchases', label: 'Purchases', description: 'Bills, expenses and orders', icon: Building2 },
  { href: '/cash-banks', label: 'Cash & Banks', description: 'Collections and receivables', icon: Landmark },
  { href: '/production', label: 'Production', description: 'Garment production workflow', icon: Factory },
  { href: '/reports', label: 'Reports', description: 'Sales and inventory insights', icon: BarChart3 },
  { href: '/settings', label: 'Settings', description: 'Business preferences', icon: Settings },
];

export default function CommandMenu() {
  const router = useRouter();
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

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
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COMMANDS;
    return COMMANDS.filter(({ label, description, keywords }) =>
      `${label} ${description} ${keywords ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-9 w-full max-w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Open quick navigation"
      >
        <Search aria-hidden="true" size={15} className="text-slate-400 group-hover:text-blue-600" />
        <span className="flex-1">Jump to…</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <Modal title="Quick navigation" onClose={() => setOpen(false)} size="md" initialFocusRef={inputRef}>
          <label htmlFor={searchId} className="sr-only">Search pages and actions</label>
          <div className="relative">
            <Search aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) navigate(results[0].href);
              }}
              className="input-field pl-10"
              placeholder="Search pages or actions…"
              autoComplete="off"
            />
          </div>
          <div className="mt-3 max-h-[min(420px,55vh)] space-y-1 overflow-y-auto" aria-label="Navigation results">
            {results.map(({ href, label, description, icon: Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => navigate(href)}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-blue-100 group-hover:text-blue-700">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{label}</span>
                  <span className="block truncate text-xs text-slate-500">{description}</span>
                </span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No matching page or action.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
