'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Clock3,
  Factory,
  FileText,
  IndianRupee,
  Package,
  PackageCheck,
  Palette,
  Plus,
  ReceiptText,
  Scissors,
  Shirt,
  TrendingUp,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import StatusBadge from '@/components/StatusBadge';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Party, Invoice, Item, ProductionOrder, ProductionStageType } from '@/types';

const STAGES: Array<{ type: ProductionStageType; label: string; icon: typeof Scissors; color: string }> = [
  { type: 'CUTTING', label: 'Cutting', icon: Scissors, color: 'bg-blue-500' },
  { type: 'PRINT_EMBROIDERY', label: 'Print / Emb', icon: Palette, color: 'bg-violet-500' },
  { type: 'STITCHING', label: 'Stitching', icon: Shirt, color: 'bg-amber-500' },
  { type: 'PACKING', label: 'Packing', icon: PackageCheck, color: 'bg-emerald-500' },
];

type DashboardData = {
  invoices: Invoice[];
  production: ProductionOrder[];
  parties: Party[];
  items: Item[];
};

const EMPTY_DATA: DashboardData = { invoices: [], production: [], parties: [], items: [] };

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [partialWarning, setPartialWarning] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setPartialWarning('');

    const results = await Promise.allSettled([
      getAllPages<Invoice>('/invoices'),
      getAllPages<ProductionOrder>('/production-orders'),
      getAllPages<Party>('/parties'),
      getAllPages<Item>('/items'),
    ]);

    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length === results.length) {
      const reason = results[0].status === 'rejected' ? results[0].reason : undefined;
      setError(getApiError(reason, 'Could not load your business dashboard.'));
      setLoading(false);
      return;
    }

    setData({
      invoices: results[0].status === 'fulfilled' ? results[0].value.data : [],
      production: results[1].status === 'fulfilled' ? results[1].value.data : [],
      parties: results[2].status === 'fulfilled' ? results[2].value.data : [],
      items: results[3].status === 'fulfilled' ? results[3].value.data : [],
    });
    if (failed.length > 0) setPartialWarning('Some dashboard information is temporarily unavailable.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const insights = useMemo(() => calculateInsights(data), [data]);

  return (
    <>
      <HeroHeader />

      {loading ? (
        <section className="card"><LoadingState label="Preparing your business dashboard..." /></section>
      ) : error ? (
        <section className="card"><ErrorState message={error} onRetry={loadDashboard} /></section>
      ) : (
        <>
          {partialWarning && (
            <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800">
              <AlertCircle aria-hidden="true" size={15} /> {partialWarning}
            </div>
          )}

          <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Business summary">
            <SummaryCard icon={IndianRupee} label="Total collected" value={formatCurrency(insights.collected)} detail={`${insights.collectionRate}% collection rate`} tone="emerald" />
            <SummaryCard icon={CircleDollarSign} label="Outstanding" value={formatCurrency(insights.outstanding)} detail={`${insights.unpaidInvoices} invoices pending`} tone="amber" />
            <SummaryCard icon={Factory} label="Active production" value={insights.activeOrders.toLocaleString('en-IN')} detail={`${insights.piecesInProduction.toLocaleString('en-IN')} pieces running`} tone="blue" />
            <SummaryCard icon={TrendingUp} label="Projected profit" value={formatCurrency(insights.projectedProfit)} detail={`${insights.averageMargin}% average margin`} tone={insights.projectedProfit >= 0 ? 'violet' : 'red'} />
          </section>

          <section className="mb-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
            <ProductionOverview orders={data.production} stageTotals={insights.stageTotals} />
            <FinancialSnapshot insights={insights} />
          </section>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_280px]">
            <RecentInvoices invoices={data.invoices} />
            <RecentProduction orders={data.production} />
            <BusinessPulse data={data} insights={insights} />
          </section>
        </>
      )}
    </>
  );
}

function HeroHeader() {
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  return (
    <header className="relative mb-4 overflow-hidden rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-xl shadow-slate-200 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(37,99,235,0.35),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(124,58,237,0.24),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.8)]" /> Live business overview
          </div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Business command centre</h1>
          <p className="mt-1 text-xs text-slate-400">Billing, inventory and garment production in one clear workspace · {today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/production" className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3.5 text-xs font-bold text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <Factory aria-hidden="true" size={15} /> Production
          </Link>
          <Link href="/invoices/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-xs font-bold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <Plus aria-hidden="true" size={15} /> New invoice
          </Link>
        </div>
      </div>
    </header>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone }: { icon: typeof IndianRupee; label: string; value: string; detail: string; tone: string }) {
  const tones: Record<string, { icon: string; line: string }> = {
    emerald: { icon: 'bg-emerald-50 text-emerald-600', line: 'bg-emerald-500' },
    amber: { icon: 'bg-amber-50 text-amber-600', line: 'bg-amber-500' },
    blue: { icon: 'bg-blue-50 text-blue-600', line: 'bg-blue-500' },
    violet: { icon: 'bg-violet-50 text-violet-600', line: 'bg-violet-500' },
    red: { icon: 'bg-red-50 text-red-600', line: 'bg-red-500' },
  };
  const style = tones[tone];
  return (
    <article className="card group relative overflow-hidden p-3.5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-4">
      <span className={clsx('absolute inset-x-0 top-0 h-0.5', style.line)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">{value}</p>
          <p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p>
        </div>
        <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105', style.icon)}><Icon aria-hidden="true" size={18} /></span>
      </div>
    </article>
  );
}

function ProductionOverview({ orders, stageTotals }: { orders: ProductionOrder[]; stageTotals: ReturnType<typeof calculateInsights>['stageTotals'] }) {
  const active = orders.filter(({ status }) => !['COMPLETED', 'CANCELLED'].includes(status));
  return (
    <article className="card overflow-hidden">
      <CardHeader icon={Factory} title="Production floor" description="Live progress across every active garment order" href="/production" linkLabel="Open production" />
      <div className="grid gap-2.5 border-b border-slate-100 p-3 sm:grid-cols-4 sm:p-4">
        {STAGES.map(({ type, label, icon: Icon, color }) => {
          const stage = stageTotals[type];
          return (
            <div key={type} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2"><span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg text-white', color)}><Icon aria-hidden="true" size={15} /></span><strong className="text-xs text-slate-900">{stage.progress}%</strong></div>
              <p className="mt-2 text-[11px] font-bold text-slate-800">{label}</p>
              <p className="mt-0.5 text-[9px] text-slate-400">{stage.completed.toLocaleString('en-IN')} / {stage.planned.toLocaleString('en-IN')} pcs</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200"><div className={clsx('h-full rounded-full', color)} style={{ width: `${stage.progress}%` }} /></div>
            </div>
          );
        })}
      </div>
      {active.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center px-4 text-xs text-slate-500">No active production orders.</div>
      ) : (
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
          {active.slice(0, 4).map((order) => (
            <Link key={order.id} href="/production" className="group bg-white px-4 py-3 transition hover:bg-blue-50/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 group-hover:text-blue-700">{order.styleName}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{order.orderNumber} · {order.party.name}</p></div>
                <span className="text-[10px] font-bold text-blue-600">{order.summary.progressPercent}%</span>
              </div>
              <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${order.summary.progressPercent}%` }} /></div><span className="text-[9px] text-slate-400">{order.orderedQty} pcs</span></div>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

function FinancialSnapshot({ insights }: { insights: ReturnType<typeof calculateInsights> }) {
  return (
    <article className="relative overflow-hidden rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(37,99,235,0.32),transparent_38%)]" />
      <div className="relative border-b border-white/10 p-4 sm:p-5">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300">Financial health</p><h2 className="mt-1 text-sm font-bold">Revenue performance</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blue-300"><TrendingUp aria-hidden="true" size={18} /></span></div>
        <p className="mt-4 text-[10px] text-slate-400">Total invoiced</p><p className="mt-0.5 text-2xl font-extrabold tracking-tight">{formatCurrency(insights.invoiced)}</p>
        <div className="mt-3 flex items-center justify-between text-[10px]"><span className="text-slate-400">Collected {formatCurrency(insights.collected)}</span><strong className="text-emerald-300">{insights.collectionRate}%</strong></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${insights.collectionRate}%` }} /></div>
      </div>
      <div className="relative grid grid-cols-2 divide-x divide-white/10">
        <DarkStat label="Receivable" value={formatCurrency(insights.outstanding)} note={`${insights.overdueInvoices} overdue`} />
        <DarkStat label="Production margin" value={`${insights.averageMargin}%`} note={formatCurrency(insights.projectedProfit)} />
      </div>
    </article>
  );
}

function DarkStat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-base font-extrabold text-white">{value}</p><p className="mt-0.5 text-[9px] text-slate-500">{note}</p></div>;
}

function RecentInvoices({ invoices }: { invoices: Invoice[] }) {
  return (
    <article className="card overflow-hidden">
      <CardHeader icon={ReceiptText} title="Recent invoices" description="Latest party billing activity" href="/invoices" linkLabel="View all" />
      {invoices.length === 0 ? (
        <CompactEmpty icon={FileText} text="No invoices created yet." href="/invoices/new" action="Create invoice" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[510px] text-xs">
            <thead className="bg-slate-50/80 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5">Party</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.slice(0, 5).map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-3"><Link href={`/invoices/${invoice.id}`} className="font-bold text-blue-600 hover:underline">{invoice.invoiceNumber}</Link><span className="mt-0.5 block text-[9px] text-slate-400">{formatDate(invoice.issueDate)}</span></td>
                  <td className="max-w-36 truncate px-4 py-3 font-medium text-slate-700">{invoice.party?.name ?? 'Unknown'}</td>
                  <td className="px-4 py-3"><StatusBadge status={invoice.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(invoice.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function RecentProduction({ orders }: { orders: ProductionOrder[] }) {
  return (
    <article className="card overflow-hidden">
      <CardHeader icon={Boxes} title="Production orders" description="Recent styles and delivery status" href="/production" linkLabel="View all" />
      {orders.length === 0 ? (
        <CompactEmpty icon={Factory} text="No production orders yet." href="/production" action="Start production" />
      ) : (
        <div className="divide-y divide-slate-100">
          {orders.slice(0, 5).map((order) => (
            <Link key={order.id} href="/production" className="group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Shirt aria-hidden="true" size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800 group-hover:text-blue-700">{order.styleName}</span><span className="mt-0.5 block truncate text-[9px] text-slate-400">{order.orderNumber} · {order.orderedQty} pcs · Due {formatDate(order.dueDate)}</span></span>
              <StatusBadge status={order.status} />
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

function BusinessPulse({ data, insights }: { data: DashboardData; insights: ReturnType<typeof calculateInsights> }) {
  const pulse = [
    { label: 'Parties', value: data.parties.length, icon: Users, color: 'bg-blue-50 text-blue-600', href: '/parties' },
    { label: 'Items', value: data.items.length, icon: Package, color: 'bg-violet-50 text-violet-600', href: '/items' },
    { label: 'Low stock', value: insights.lowStock, icon: AlertCircle, color: insights.lowStock ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600', href: '/items' },
    { label: 'Due soon', value: insights.ordersDueSoon, icon: Clock3, color: 'bg-amber-50 text-amber-600', href: '/production' },
  ];
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Business pulse</h2><p className="mt-0.5 text-[10px] text-slate-500">Masters and attention items</p></div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {pulse.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="rounded-xl border border-slate-200 p-2.5 transition hover:border-blue-200 hover:shadow-sm">
            <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', color)}><Icon aria-hidden="true" size={15} /></span>
            <strong className="mt-2 block text-base text-slate-950">{value}</strong><span className="text-[9px] font-semibold text-slate-500">{label}</span>
          </Link>
        ))}
      </div>
      <div className="border-t border-slate-100 p-3">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Quick actions</p>
        <div className="space-y-1">
          <QuickLink href="/parties" label="Add party" icon={Users} />
          <QuickLink href="/items" label="Add inventory item" icon={Package} />
          <QuickLink href="/invoices/new" label="Create invoice" icon={ReceiptText} />
        </div>
      </div>
    </article>
  );
}

function CardHeader({ icon: Icon, title, description, href, linkLabel }: { icon: typeof Factory; title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon aria-hidden="true" size={15} /></span><div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900">{title}</h2><p className="truncate text-[10px] text-slate-500">{description}</p></div></div>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700">{linkLabel}<ArrowRight aria-hidden="true" size={13} /></Link>
    </div>
  );
}

function CompactEmpty({ icon: Icon, text, href, action }: { icon: typeof Factory; text: string; href: string; action: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center p-5 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Icon aria-hidden="true" size={18} /></span><p className="mt-2 text-xs text-slate-500">{text}</p><Link href={href} className="mt-2 text-[10px] font-bold text-blue-600 hover:underline">{action}</Link></div>;
}

function QuickLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Users }) {
  return <Link href={href} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"><Icon aria-hidden="true" size={13} /><span className="flex-1">{label}</span><ArrowRight aria-hidden="true" size={12} className="opacity-0 transition group-hover:opacity-100" /></Link>;
}

function calculateInsights(data: DashboardData) {
  const invoiced = data.invoices.reduce((total, invoice) => total + Number(invoice.grandTotal), 0);
  const collected = data.invoices.reduce((total, invoice) => total + Number(invoice.amountPaid), 0);
  const outstanding = Math.max(0, invoiced - collected);
  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const active = data.production.filter(({ status }) => !['COMPLETED', 'CANCELLED'].includes(status));
  const totalProductionRevenue = data.production.reduce((total, order) => total + order.summary.revenue, 0);
  const projectedProfit = data.production.reduce((total, order) => total + order.summary.profit, 0);
  const stageTotals = Object.fromEntries(STAGES.map(({ type }) => {
    const stages = active.flatMap((order) => order.stages.filter((stage) => stage.type === type));
    const planned = stages.reduce((total, stage) => total + stage.plannedQty, 0);
    const completed = stages.reduce((total, stage) => total + stage.completedQty, 0);
    return [type, { planned, completed, progress: planned ? Math.min(100, Math.round((completed / planned) * 100)) : 0 }];
  })) as Record<ProductionStageType, { planned: number; completed: number; progress: number }>;

  return {
    invoiced,
    collected,
    outstanding,
    collectionRate: invoiced ? Math.min(100, Number(((collected / invoiced) * 100).toFixed(1))) : 0,
    unpaidInvoices: data.invoices.filter(({ status }) => status === 'UNPAID' || status === 'PARTIALLY_PAID').length,
    overdueInvoices: data.invoices.filter((invoice) => invoice.dueDate && new Date(invoice.dueDate).getTime() < now && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED').length,
    activeOrders: active.length,
    piecesInProduction: active.reduce((total, order) => total + order.orderedQty, 0),
    projectedProfit,
    averageMargin: totalProductionRevenue ? Number(((projectedProfit / totalProductionRevenue) * 100).toFixed(1)) : 0,
    lowStock: data.items.filter((item) => Number(item.stockQty) <= 5).length,
    ordersDueSoon: active.filter((order) => order.dueDate && new Date(order.dueDate).getTime() >= now && new Date(order.dueDate).getTime() <= weekAhead).length,
    stageTotals,
  };
}
