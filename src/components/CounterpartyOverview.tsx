'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Building2, Plus, Users, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { CounterpartyRow, CounterpartySummary } from '@/lib/counterparty-dashboard';

type PanelProps = {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  summary: CounterpartySummary;
  periodLabel: string;
  dueLabel: string;
  countLabel: string;
  viewHref: string;
  addHref: string;
  addLabel: string;
  rowHref?: (row: CounterpartyRow) => string;
  emptyText: string;
};

export default function CounterpartyOverview({ customers, suppliers }: { customers: CounterpartySummary; suppliers: CounterpartySummary }) {
  return (
    <div className="mb-5 grid min-w-0 gap-5 lg:grid-cols-2">
      <CounterpartyPanel
        eyebrow="WHO BUYS FROM YOU"
        title="Customers"
        icon={Users}
        summary={customers}
        periodLabel="Sales"
        dueLabel="Receivable"
        countLabel="customers"
        viewHref="/parties/details"
        addHref="/parties/details?create=1"
        addLabel="Add customer"
        rowHref={(row) => `/parties/${row.id}`}
        emptyText="No customer sales or dues in this period."
      />
      <CounterpartyPanel
        eyebrow="WHO YOU BUY FROM"
        title="Suppliers"
        icon={Building2}
        summary={suppliers}
        periodLabel="Purchases"
        dueLabel="Payable"
        countLabel="suppliers"
        viewHref="/purchases/suppliers"
        addHref="/purchases/suppliers?create=1"
        addLabel="Add supplier"
        rowHref={() => '/purchases/suppliers'}
        emptyText="No supplier purchases or dues in this period."
      />
    </div>
  );
}

function CounterpartyPanel({ eyebrow, title, icon: Icon, summary, periodLabel, dueLabel, countLabel, viewHref, addHref, addLabel, rowHref, emptyText }: PanelProps) {
  const max = Math.max(1, ...summary.top.map((row) => row.periodAmount));
  return (
    <section className="brand-panel" aria-label={`${title} overview`}>
      <div className="brand-panel-heading">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#2348c8]"><Icon aria-hidden="true" size={19} /></span>
          <div className="min-w-0"><p className="brand-eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        </div>
        <Link href={viewHref} className="brand-text-link whitespace-nowrap">View all <ArrowRight size={15} /></Link>
      </div>

      <dl className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-[#f6f7fb] p-3">
        <div className="min-w-0"><dt className="truncate text-[11px] font-semibold text-[#717784]">Total {countLabel}</dt><dd className="mt-1 text-lg font-bold tabular-nums text-[#242934]">{summary.total.toLocaleString('en-IN')}</dd></div>
        <div className="min-w-0"><dt className="truncate text-[11px] font-semibold text-[#717784]">{periodLabel} this period</dt><dd className="mt-1 truncate text-lg font-bold tabular-nums text-[#242934]">{formatCurrency(summary.periodAmount)}</dd></div>
        <div className="min-w-0"><dt className="truncate text-[11px] font-semibold text-[#717784]">{dueLabel}</dt><dd className="mt-1 truncate text-lg font-bold tabular-nums text-[#242934]">{formatCurrency(summary.outstanding)}</dd><p className="truncate text-[11px] text-[#717784]">{summary.withDues} with dues</p></div>
      </dl>

      {summary.top.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e2e5ec] px-4 py-6 text-center text-xs text-[#717784]">{emptyText}</p>
      ) : (
        <ol className="space-y-1">
          {summary.top.map((row, index) => {
            const content = (
              <>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f1f3f8] text-[11px] font-bold text-[#616a7c]">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <strong className="truncate text-[13px] font-semibold text-[#242934]">{row.name}</strong>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#242934]">{formatCurrency(row.periodAmount)}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#eef0f5]"><span className="block h-full rounded-full bg-[#2348c8]" style={{ width: `${row.periodAmount > 0 ? Math.max(2, (row.periodAmount / max) * 100) : 0}%` }} /></span>
                  <span className="mt-1 flex items-center justify-between gap-3 text-[11px] text-[#717784]">
                    <span className="truncate">{row.count} {row.count === 1 ? 'bill' : 'bills'} this period{row.phone ? ` · ${row.phone}` : ''}</span>
                    <span className={row.outstanding > 0 ? 'shrink-0 font-semibold text-[#b45309]' : 'shrink-0'}>{row.outstanding > 0 ? `${formatCurrency(row.outstanding)} due` : 'No dues'}</span>
                  </span>
                </span>
              </>
            );
            return (
              <li key={row.id}>
                {rowHref
                  ? <Link href={rowHref(row)} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#f6f7fb]">{content}<ArrowUpRight aria-hidden="true" size={15} className="shrink-0 text-[#a0a6b4] group-hover:text-[#2348c8]" /></Link>
                  : <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">{content}</div>}
              </li>
            );
          })}
        </ol>
      )}

      <Link href={addHref} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2348c8] hover:underline"><Plus aria-hidden="true" size={14} />{addLabel}</Link>
    </section>
  );
}
