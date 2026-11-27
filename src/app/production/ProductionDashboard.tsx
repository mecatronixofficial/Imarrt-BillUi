'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Factory,
  FileText,
  IndianRupee,
  KanbanSquare,
  LayoutDashboard,
  List,
  PackageCheck,
  PieChart,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';
import { buildProductionInsights, currentProcess, daysUntilDue, PROCESS_COLUMNS, type ProcessColumn, type ProductionInsights } from '@/lib/production-dashboard';
import type { ProductionOrder } from '@/types';
import { processLabel, processShortLabel, STAGE_META } from './productionMeta';

export type ProductionView = 'dashboard' | 'board' | 'list';

const VIEWS: Array<{ id: ProductionView; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'board', label: 'Board', icon: KanbanSquare },
  { id: 'list', label: 'Orders', icon: List },
];

const pcs = (value: number) => `${value.toLocaleString('en-IN')} pcs`;

function processIcon(process: ProcessColumn): LucideIcon {
  if (process === 'DRAFT') return FileText;
  if (process === 'DELIVERED') return Truck;
  return STAGE_META[process].icon;
}

/* -------------------------------------------------------------------------- */
/* View switcher                                                              */
/* -------------------------------------------------------------------------- */

export function ProductionViewTabs({ view, onChange, counts }: { view: ProductionView; onChange: (view: ProductionView) => void; counts: { orders: number; active: number } }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div role="tablist" aria-label="Production views" className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => onChange(id)}
            className={clsx(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition sm:flex-none',
              view === id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
            )}
          >
            <Icon aria-hidden="true" size={14} />
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs font-semibold text-slate-500">{counts.orders} orders · <span className="text-blue-600">{counts.active} in production</span></p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export function ProductionDashboard({ orders, onOpenOrder, onShowProcess, onShowAll }: { orders: ProductionOrder[]; onOpenOrder: (id: string) => void; onShowProcess: (process: ProcessColumn) => void; onShowAll: () => void }) {
  const insights = useMemo(() => buildProductionInsights(orders), [orders]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile icon={TrendingUp} tone="blue" label="Active orders" value={String(insights.activeOrders)} hint={`${insights.draftOrders} drafts · ${insights.deliveredOrders} delivered`} />
        <KpiTile icon={Boxes} tone="violet" label="Pieces in production" value={insights.activePieces.toLocaleString('en-IN')} hint="Across active orders" />
        <KpiTile icon={ClipboardList} tone="slate" label="Order value" value={formatCurrency(insights.revenue)} hint="Confirmed orders" />
        <KpiTile icon={IndianRupee} tone="amber" label="Making cost" value={formatCurrency(insights.makingCost)} hint="Process + material" />
        <KpiTile icon={CircleDollarSign} tone={insights.profit < 0 ? 'red' : 'emerald'} label="Projected profit" value={formatCurrency(insights.profit)} hint={`${insights.marginPercent}% margin`} />
        <KpiTile icon={AlertTriangle} tone={insights.overdue.length ? 'red' : 'slate'} label="Overdue" value={String(insights.overdue.length)} hint={`${insights.dueSoon.length} due in 7 days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" icon={Factory} title="Production pipeline" subtitle="Where every order is right now. Select a stage to see its orders.">
          <PipelineChart insights={insights} onShowProcess={onShowProcess} />
        </Panel>
        <Panel icon={CalendarClock} title="Needs attention" subtitle="Overdue and due within 7 days">
          <AttentionList insights={insights} onOpenOrder={onOpenOrder} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel icon={PieChart} title="Profit and cost">
          <CostSplit insights={insights} />
        </Panel>
        <Panel icon={PackageCheck} title="Stage yield" subtitle="Completed vs planned pieces">
          <StageYield insights={insights} />
        </Panel>
        <Panel icon={Users} title="Top customers" subtitle="By pieces ordered">
          <TopCustomers insights={insights} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel icon={ClipboardList} title="Order status">
          <StatusMix insights={insights} />
        </Panel>
        <Panel className="lg:col-span-2" icon={Clock} title="Recent orders" action={<button type="button" onClick={onShowAll} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700">View all <ArrowRight aria-hidden="true" size={13} /></button>}>
          <RecentOrders orders={insights.recent} onOpenOrder={onOpenOrder} />
        </Panel>
      </div>
    </div>
  );
}

const KPI_TONES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-600',
};

function KpiTile({ icon: Icon, label, value, hint, tone }: { icon: LucideIcon; label: string; value: string; hint: string; tone: string }) {
  return (
    <article className="card min-w-0 p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', KPI_TONES[tone])}><Icon aria-hidden="true" size={14} /></span>
      </div>
      <p className="mt-2 truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{hint}</p>
    </article>
  );
}

function Panel({ icon: Icon, title, subtitle, action, className, children }: { icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx('card min-w-0 p-4 sm:p-5', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon aria-hidden="true" size={15} /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-950">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">{children}</p>;
}

function PipelineChart({ insights, onShowProcess }: { insights: ProductionInsights; onShowProcess: (process: ProcessColumn) => void }) {
  const max = Math.max(1, ...insights.pipeline.map(({ pieces }) => pieces));
  return (
    <ol className="space-y-1">
      {insights.pipeline.map(({ process, orders, pieces }) => {
        const Icon = processIcon(process);
        return (
          <li key={process}>
            <button
              type="button"
              onClick={() => onShowProcess(process)}
              disabled={orders === 0}
              aria-label={`${processLabel(process)}: ${orders} orders, ${pcs(pieces)}`}
              className="group grid w-full grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent sm:grid-cols-[minmax(0,11rem)_1fr_auto]"
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
                <Icon aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
                <span className="truncate">{processLabel(process)}</span>
              </span>
              <span className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                {pieces > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-all group-hover:bg-blue-700" style={{ width: `${Math.max(2, (pieces / max) * 100)}%` }} />}
              </span>
              <span className="min-w-[6.5rem] text-right text-xs tabular-nums text-slate-500">
                <strong className="font-extrabold text-slate-900">{orders}</strong> {orders === 1 ? 'order' : 'orders'} · {pieces.toLocaleString('en-IN')}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function CostSplit({ insights }: { insights: ProductionInsights }) {
  const costTotal = insights.processCost + insights.materialCost;
  const materialShare = costTotal > 0 ? (insights.materialCost / costTotal) * 100 : 0;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Projected profit</p>
        <p className={clsx('mt-1 text-2xl font-extrabold tracking-tight', insights.profit < 0 ? 'text-red-600' : 'text-slate-950')}>{formatCurrency(insights.profit)}</p>
        <p className="mt-0.5 text-xs text-slate-500">{insights.marginPercent}% margin on {formatCurrency(insights.revenue)} order value</p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Making cost</span>
          <span className="font-extrabold text-slate-950">{formatCurrency(costTotal)}</span>
        </div>
        {costTotal > 0 ? (
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Material ${formatCurrency(insights.materialCost)}, process ${formatCurrency(insights.processCost)}`}>
            {insights.materialCost > 0 && <span title={`Material: ${formatCurrency(insights.materialCost)}`} className="h-full bg-blue-700" style={{ width: `${materialShare}%` }} />}
            {insights.processCost > 0 && <span title={`Process: ${formatCurrency(insights.processCost)}`} className="h-full bg-blue-300" style={{ width: `${100 - materialShare}%` }} />}
          </div>
        ) : <div className="h-3 rounded-full bg-slate-100" />}
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-2 text-slate-600"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue-700" />Material</dt><dd className="font-bold text-slate-900">{formatCurrency(insights.materialCost)}</dd></div>
          <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-2 text-slate-600"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue-300" />Process / job work</dt><dd className="font-bold text-slate-900">{formatCurrency(insights.processCost)}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function AttentionList({ insights, onOpenOrder }: { insights: ProductionInsights; onOpenOrder: (id: string) => void }) {
  const entries = [...insights.overdue, ...insights.dueSoon].slice(0, 6);
  if (entries.length === 0) return <EmptyNote>Nothing overdue or due this week.</EmptyNote>;
  return (
    <ul className="space-y-2">
      {entries.map(({ order, days }) => {
        const late = days < 0;
        return (
          <li key={order.id}>
            <button type="button" onClick={() => onOpenOrder(order.id)} className={clsx('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:shadow-sm', late ? 'border-red-100 bg-red-50/60 hover:border-red-200' : 'border-amber-100 bg-amber-50/60 hover:border-amber-200')}>
              <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', late ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700')}>
                {late ? <AlertTriangle aria-hidden="true" size={15} /> : <Clock aria-hidden="true" size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold text-slate-900">{order.orderNumber}</span>
                <span className="block truncate text-[11px] text-slate-500">{order.party.name} · {processShortLabel(currentProcess(order))}</span>
              </span>
              <span className={clsx('shrink-0 text-right text-[11px] font-bold', late ? 'text-red-700' : 'text-amber-800')}>
                {late ? `${-days}d late` : days === 0 ? 'Due today' : `In ${days}d`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StageYield({ insights }: { insights: ProductionInsights }) {
  if (insights.stageYield.length === 0) return <EmptyNote>Stage quantities appear once orders move into production.</EmptyNote>;
  return (
    <ul className="space-y-3">
      {insights.stageYield.map(({ type, planned, completed, rejected, percent }) => (
        <li key={type} title={`${STAGE_META[type].label}: ${completed.toLocaleString('en-IN')} of ${planned.toLocaleString('en-IN')} completed, ${rejected.toLocaleString('en-IN')} rejected`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-slate-700">{STAGE_META[type].shortLabel}</span>
            <span className="shrink-0 tabular-nums text-slate-500"><strong className="text-slate-900">{percent}%</strong> · {completed.toLocaleString('en-IN')}/{planned.toLocaleString('en-IN')}{rejected > 0 && <span className="text-red-600"> · {rejected} rej</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function TopCustomers({ insights }: { insights: ProductionInsights }) {
  if (insights.topCustomers.length === 0) return <EmptyNote>No customer orders yet.</EmptyNote>;
  const max = Math.max(1, ...insights.topCustomers.map(({ pieces }) => pieces));
  return (
    <ol className="space-y-3">
      {insights.topCustomers.map((customer, index) => (
        <li key={customer.id} title={`${customer.name}: ${customer.orders} orders, ${pcs(customer.pieces)}, ${formatCurrency(customer.revenue)}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">{index + 1}</span><span className="truncate font-semibold text-slate-800">{customer.name}</span></span>
            <span className="shrink-0 tabular-nums text-slate-500"><strong className="text-slate-900">{customer.pieces.toLocaleString('en-IN')}</strong> pcs · {customer.orders}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, (customer.pieces / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ol>
  );
}

function StatusMix({ insights }: { insights: ProductionInsights }) {
  if (insights.statusCounts.length === 0) return <EmptyNote>No orders yet.</EmptyNote>;
  const max = Math.max(1, ...insights.statusCounts.map(({ count }) => count));
  return (
    <ul className="space-y-2.5">
      {insights.statusCounts.map(({ status, count }) => (
        <li key={status} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3">
          <span><StatusBadge status={status} /></span>
          <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-slate-500" style={{ width: `${(count / max) * 100}%` }} /></span>
          <span className="text-right text-xs font-extrabold tabular-nums text-slate-900">{count}</span>
        </li>
      ))}
    </ul>
  );
}

function RecentOrders({ orders, onOpenOrder }: { orders: ProductionOrder[]; onOpenOrder: (id: string) => void }) {
  if (orders.length === 0) return <EmptyNote>No orders yet.</EmptyNote>;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-2.5 sm:px-5">Order</th>
            <th className="px-3 py-2.5">Customer</th>
            <th className="px-3 py-2.5">Process</th>
            <th className="px-3 py-2.5 text-right">Pieces</th>
            <th className="px-3 py-2.5">Progress</th>
            <th className="px-4 py-2.5 text-right sm:px-5">Delivery</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} onClick={() => onOpenOrder(order.id)} className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-blue-50/40">
              <td className="px-4 py-3 sm:px-5">
                <button type="button" onClick={(event) => { event.stopPropagation(); onOpenOrder(order.id); }} className="font-extrabold text-slate-950 hover:text-blue-700">{order.orderNumber}</button>
                <span className="block truncate text-[11px] text-slate-500">{order.styleName}</span>
              </td>
              <td className="max-w-40 truncate px-3 py-3 font-semibold text-slate-700">{order.party.name}</td>
              <td className="px-3 py-3"><StatusBadge status={order.status} /><span className="ml-2 text-slate-500">{processShortLabel(currentProcess(order))}</span></td>
              <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">{order.orderedQty.toLocaleString('en-IN')}</td>
              <td className="px-3 py-3">
                <span className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.min(order.summary.progressPercent, 100)}%` }} /></span><span className="font-semibold tabular-nums text-slate-600">{order.summary.progressPercent}%</span></span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-600 sm:px-5">{order.dueDate ? formatDate(order.dueDate) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Board (kanban by current process)                                          */
/* -------------------------------------------------------------------------- */

export function ProductionBoard({ orders, onOpenOrder }: { orders: ProductionOrder[]; onOpenOrder: (id: string) => void }) {
  const columns = useMemo(() => PROCESS_COLUMNS.map((process) => ({
    process,
    orders: orders.filter((order) => currentProcess(order) === process),
  })), [orders]);
  const cancelled = orders.filter((order) => order.status === 'CANCELLED').length;

  return (
    <section className="min-w-0">
      <div className="-mx-1 overflow-x-auto pb-3">
        <div className="flex min-w-max gap-3 px-1">
          {columns.map(({ process, orders: columnOrders }) => {
            const Icon = processIcon(process);
            const pieces = columnOrders.reduce((total, order) => total + order.orderedQty, 0);
            return (
              <section key={process} aria-label={`${processLabel(process)} column`} className={clsx('flex w-72 shrink-0 flex-col rounded-2xl border p-2.5', columnOrders.length ? 'border-slate-200 bg-slate-100/70' : 'border-dashed border-slate-200 bg-white/60')}>
                <header className="mb-2 flex items-center justify-between gap-2 px-1.5 py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', process === 'DRAFT' ? 'bg-slate-200 text-slate-600' : process === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' : STAGE_META[process].accent)}><Icon aria-hidden="true" size={14} /></span>
                    <span className="truncate text-xs font-extrabold text-slate-900">{processLabel(process)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-sm">{columnOrders.length}</span>
                </header>
                {columnOrders.length > 0 && <p className="mb-2 px-1.5 text-[11px] font-semibold text-slate-500">{pcs(pieces)}</p>}
                <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto">
                  {columnOrders.length === 0 ? <p className="px-1.5 py-4 text-center text-[11px] text-slate-400">No orders</p> : columnOrders.map((order) => <BoardCard key={order.id} order={order} onOpen={() => onOpenOrder(order.id)} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {cancelled > 0 && <p className="mt-1 text-xs text-slate-500">{cancelled} cancelled {cancelled === 1 ? 'order is' : 'orders are'} hidden from the board.</p>}
    </section>
  );
}

function BoardCard({ order, onOpen }: { order: ProductionOrder; onOpen: () => void }) {
  const days = daysUntilDue(order);
  const late = days !== undefined && days < 0;
  const soon = days !== undefined && days >= 0 && days <= 7;
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-xs font-extrabold text-slate-950">{order.orderNumber}</p>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-700">{order.orderedQty.toLocaleString('en-IN')} pcs</span>
      </div>
      <p className="mt-1 truncate text-[11px] font-semibold text-slate-600">{order.party.name}</p>
      <p className="truncate text-[11px] text-slate-400">{order.styleName}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.min(order.summary.progressPercent, 100)}%` }} /></span>
        <span className="text-[10px] font-bold tabular-nums text-slate-500">{order.summary.progressPercent}%</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold">
        <span className={clsx('inline-flex items-center gap-1', late ? 'text-red-600' : soon ? 'text-amber-700' : 'text-slate-400')}>
          {late ? <AlertTriangle aria-hidden="true" size={11} /> : <CalendarClock aria-hidden="true" size={11} />}
          {order.dueDate ? (late ? `${-(days ?? 0)}d late` : formatDate(order.dueDate)) : 'No date'}
        </span>
        <span className="text-slate-500">{formatCurrency(order.summary.totalMakingCost)}</span>
      </div>
    </button>
  );
}
