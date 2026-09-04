'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Package, Percent, Printer, Repeat, SlidersHorizontal, Users } from 'lucide-react';
import clsx from 'clsx';
import PageHeader from '@/components/PageHeader';

const TABS = [
  { href: '/settings/general', label: 'General', icon: SlidersHorizontal },
  { href: '/settings/transaction', label: 'Transaction', icon: Repeat },
  { href: '/settings/print', label: 'Print', icon: Printer },
  { href: '/settings/taxes-gst', label: 'Taxes & GST', icon: Percent },
  { href: '/settings/transaction-message', label: 'Transaction Message', icon: MessageSquare },
  { href: '/settings/party', label: 'Party', icon: Users },
  { href: '/settings/item', label: 'Item', icon: Package },
] as const;

export default function PreferencesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <PageHeader title="Preferences" description="Defaults applied across invoices, print-outs, tax, messaging, parties, and items." />
      <nav aria-label="Settings sections" role="tablist" className="card overflow-x-auto p-1.5">
        <div className="flex min-w-max items-center gap-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                role="tab"
                aria-selected={active}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition',
                  active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon aria-hidden="true" size={15} className={active ? 'text-white' : 'text-slate-400'} />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="mt-4 min-w-0 space-y-4">{children}</div>
    </>
  );
}
