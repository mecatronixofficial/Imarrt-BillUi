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
    <div>
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
    </div>
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
<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <CardHeader
    icon={Factory}
    title="Production floor"
    description="Live progress across every active garment order"
    href="/production"
    linkLabel="Open production"
  />

  {/* Stage Summary */}
  <div className="border-b border-slate-100 bg-slate-50/40 p-3 sm:p-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STAGES.map(({ type, label, icon: Icon, color }, index) => {
        const stage = stageTotals[type];
        const progress = Math.min(stage.progress, 100);

        return (
          <div
            key={type}
            className="
              group relative overflow-hidden rounded-2xl
              border border-slate-200 bg-white
              p-4
              shadow-[0_3px_12px_rgba(15,23,42,0.04)]
              transition-all duration-300
              hover:-translate-y-1
              hover:border-blue-200
              hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)]
            "
          >
            {/* Soft hover background */}
            <div
              className="
                pointer-events-none absolute -right-12 -top-12
                h-32 w-32 rounded-full bg-blue-100/50
                opacity-0 blur-3xl
                transition-opacity duration-300
                group-hover:opacity-100
              "
            />

            {/* Card Header */}
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={clsx(
                    `
                      flex h-9 w-9 shrink-0 items-center
                      justify-center rounded-xl text-white shadow-sm
                      transition-transform duration-300
                      group-hover:scale-110
                    `,
                    color,
                  )}
                >
                  <Icon aria-hidden="true" size={16} />
                </span>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Stage {String(index + 1).padStart(2, "0")}
                  </p>

                  <h4 className="mt-0.5 text-xs font-extrabold text-slate-900">
                    {label}
                  </h4>
                </div>
              </div>
            </div>

            {/* Donut + Details */}
            <div className="relative mt-4 flex items-center gap-4">
              {/* Donut Chart */}
              <div className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  className="h-full w-full -rotate-90"
                >
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    className="text-slate-100"
                  />

                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="9"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="100"
                    strokeDashoffset={100 - progress}
                    className={clsx(
                      "transition-all duration-700",
                      color.replace("bg-", "text-"),
                    )}
                  />
                </svg>

                {/* Center Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black leading-none text-slate-900">
                    {progress}%
                  </span>

                  <span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">
                    Progress
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Completed
                  </p>

                  <p className="mt-0.5 text-sm font-black text-slate-900">
                    {stage.completed.toLocaleString("en-IN")}
                    <span className="ml-1 text-[9px] font-semibold text-slate-400">
                      pcs
                    </span>
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Planned
                  </p>

                  <p className="mt-0.5 text-xs font-extrabold text-slate-700">
                    {stage.planned.toLocaleString("en-IN")} pcs
                  </p>
                </div>
              </div>
            </div>

            {/* Remaining */}
            <div className="relative mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
              <span className="text-[9px] font-semibold text-slate-400">
                Remaining
              </span>

              <span className="text-[10px] font-extrabold text-slate-700">
                {Math.max(
                  stage.planned - stage.completed,
                  0,
                ).toLocaleString("en-IN")}{" "}
                pcs
              </span>
            </div>

            {/* Bottom Hover Line */}
            <div
              className={clsx(
                `
                  absolute bottom-0 left-0 h-[3px] w-0
                  transition-all duration-300
                  group-hover:w-full
                `,
                color,
              )}
            />
          </div>
        );
      })}
    </div>
  </div>

  {/* Active Production Orders */}
  {active.length === 0 ? (
    <div className="flex min-h-28 items-center justify-center px-4 text-xs font-medium text-slate-500">
      No active production orders.
    </div>
  ) : (
    <div className="p-3 sm:p-4">
  <div className="mb-3 flex items-center justify-between">
    <div>
      <h4 className="text-xs font-extrabold text-slate-900">
        Active Production
      </h4>

      <p className="mt-0.5 text-[10px] text-slate-400">
        Latest production orders and current progress
      </p>
    </div>

    <span className="rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
      {active.length} Active
    </span>
  </div>

  <div className="grid gap-3 sm:grid-cols-2">
    {active.slice(0, 4).map((order) => (
      <Link
        key={order.id}
        href="/production"
        className="
          group
          relative
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-4
          shadow-[0_4px_18px_rgba(15,23,42,0.05)]
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-blue-300
          hover:shadow-[0_18px_38px_rgba(37,99,235,0.12)]
        "
      >
        {/* Hover glow */}
        <div
          className="
            pointer-events-none
            absolute
            -right-10
            -top-10
            h-28
            w-28
            rounded-full
            bg-blue-100/60
            opacity-0
            blur-3xl
            transition-all
            duration-300
            group-hover:opacity-100
          "
        />

        {/* Left accent */}
        <div
          className="
            absolute
            left-0
            top-4
            h-10
            w-1
            rounded-r-full
            bg-blue-600
            transition-all
            duration-300
            group-hover:h-[calc(100%-2rem)]
          "
        />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 pl-1">
            <p
              className="
                truncate
                text-xs
                font-extrabold
                text-slate-900
                transition-colors
                duration-300
                group-hover:text-blue-700
              "
            >
              {order.styleName}
            </p>

            <p className="mt-1 truncate text-[10px] font-medium text-slate-400">
              {order.orderNumber} · {order.party.name}
            </p>
          </div>

          <div
            className="
              shrink-0
              rounded-xl
              border
              border-blue-100
              bg-blue-50
              px-2.5
              py-1.5
              transition-all
              duration-300
              group-hover:border-blue-200
              group-hover:bg-blue-600
            "
          >
            <span
              className="
                text-[10px]
                font-black
                text-blue-700
                transition-colors
                group-hover:text-white
              "
            >
              {order.summary.progressPercent}%
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div
            className="
              rounded-xl
              bg-slate-50
              px-3
              py-2.5
              transition-all
              duration-300
              group-hover:bg-blue-50/60
            "
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
              Order Qty
            </p>

            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {order.orderedQty.toLocaleString("en-IN")}
              <span className="ml-1 text-[9px] font-medium text-slate-400">
                pcs
              </span>
            </p>
          </div>

          <div
            className="
              rounded-xl
              bg-slate-50
              px-3
              py-2.5
              transition-all
              duration-300
              group-hover:bg-blue-50/60
            "
          >
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
              Progress
            </p>

            <p className="mt-1 text-sm font-extrabold text-blue-700">
              {order.summary.progressPercent}%
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="relative mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] font-semibold text-slate-400">
              Production progress
            </span>

            <span className="text-[9px] font-bold text-slate-500">
              {order.summary.progressPercent}% complete
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="
                h-full
                rounded-full
                bg-blue-600
                transition-all
                duration-700
                group-hover:bg-blue-700
              "
              style={{
                width: `${Math.min(
                  order.summary.progressPercent,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="relative mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[9px] font-medium text-slate-400">
            Active production order
          </span>

          <span
            className="
              inline-flex
              items-center
              gap-1
              rounded-lg
              bg-slate-900
              px-2.5
              py-1.5
              text-[10px]
              font-bold
              text-white
              transition-all
              duration-300
              group-hover:bg-blue-600
            "
          >
            View
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </span>
        </div>

        {/* Bottom hover line */}
        <div
          className="
            absolute
            bottom-0
            left-0
            h-[3px]
            w-0
            bg-blue-600
            transition-all
            duration-300
            group-hover:w-full
          "
        />
      </Link>
    ))}
  </div>
</div>
  )}
</article>
  );
}

function FinancialSnapshot({ insights }: { insights: ReturnType<typeof calculateInsights> }) {
  return (
   <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.07)]">
  {/* Header */}
  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
    <div>
      <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-cyan-600">
        Financial Health
      </p>

      <h2 className="mt-1 text-sm font-extrabold text-slate-950">
        Revenue Performance
      </h2>

      <p className="mt-0.5 text-[9px] text-slate-400">
        Invoice collection and financial overview
      </p>
    </div>

    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
      <TrendingUp aria-hidden="true" size={18} />
    </span>
  </div>

  {/* Charts */}
  <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.35fr_.75fr]">
    {/* LEFT — LINE / AREA CHART */}
    <div
      className="
        group relative overflow-hidden rounded-3xl
        border border-cyan-100
        bg-gradient-to-br from-cyan-50 via-sky-50/80 to-white
        p-4
        transition-all duration-300
        hover:-translate-y-0.5
        hover:shadow-[0_14px_30px_rgba(6,182,212,0.12)]
      "
    >
      {/* Background Glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-200/30 blur-3xl" />

      {/* Chart Header */}
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-700">
            Revenue Volume
          </p>

          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {formatCurrency(insights.invoiced)}
          </p>

          <p className="mt-1 text-[9px] font-medium text-slate-400">
            Total invoiced
          </p>
        </div>

        <div className="rounded-xl border border-cyan-100 bg-white/80 px-2.5 py-1.5 shadow-sm backdrop-blur">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
            Collection
          </p>

          <p className="mt-0.5 text-xs font-black text-cyan-600">
            {insights.collectionRate}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-4 h-[190px]">
        {/* Y Axis Labels */}
        <div className="absolute bottom-6 left-0 top-1 flex w-8 flex-col justify-between text-[8px] font-medium text-slate-400">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0</span>
        </div>

        {/* Chart Area */}
        <div className="absolute bottom-6 left-9 right-1 top-1">
          {/* Horizontal Lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map((line) => (
              <div
                key={line}
                className="border-t border-white/80"
              />
            ))}
          </div>

          {/* SVG */}
          <svg
            viewBox="0 0 500 150"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              {/* Area Gradient */}
              <linearGradient
                id="revenueAreaGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#67e8f9"
                  stopOpacity="0.45"
                />
                <stop
                  offset="100%"
                  stopColor="#67e8f9"
                  stopOpacity="0.02"
                />
              </linearGradient>

              {/* Line Gradient */}
              <linearGradient
                id="revenueLineGradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>

              <filter id="lineGlow">
                <feGaussianBlur
                  stdDeviation="3"
                  result="blur"
                />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Area */}
            <path
              d="
                M0 125
                C35 110, 55 90, 90 101
                C120 111, 140 68, 180 73
                C215 77, 220 95, 250 78
                C280 62, 290 110, 325 88
                C350 73, 360 32, 392 54
                C420 72, 430 45, 455 49
                C475 50, 485 25, 500 20
                L500 150
                L0 150
                Z
              "
              fill="url(#revenueAreaGradient)"
            />

            {/* Glow Line */}
            <path
              d="
                M0 125
                C35 110, 55 90, 90 101
                C120 111, 140 68, 180 73
                C215 77, 220 95, 250 78
                C280 62, 290 110, 325 88
                C350 73, 360 32, 392 54
                C420 72, 430 45, 455 49
                C475 50, 485 25, 500 20
              "
              fill="none"
              stroke="#67e8f9"
              strokeWidth="7"
              strokeOpacity="0.18"
              filter="url(#lineGlow)"
            />

            {/* Main Line */}
            <path
              d="
                M0 125
                C35 110, 55 90, 90 101
                C120 111, 140 68, 180 73
                C215 77, 220 95, 250 78
                C280 62, 290 110, 325 88
                C350 73, 360 32, 392 54
                C420 72, 430 45, 455 49
                C475 50, 485 25, 500 20
              "
              fill="none"
              stroke="url(#revenueLineGradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-500"
            />
          </svg>
        </div>

        {/* X labels */}
        <div className="absolute bottom-0 left-9 right-1 flex items-center justify-between text-[8px] font-semibold text-slate-500">
          <span>Invoiced</span>
          <span>Collected</span>
          <span>Receivable</span>
          <span>Margin</span>
          <span>Profit</span>
        </div>
      </div>

      {/* Chart Footer */}
      <div className="relative mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white bg-white/70 px-3 py-2 backdrop-blur">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
            Collected
          </p>

          <p className="mt-1 truncate text-[10px] font-extrabold text-slate-800">
            {formatCurrency(insights.collected)}
          </p>
        </div>

        <div className="rounded-xl border border-white bg-white/70 px-3 py-2 backdrop-blur">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
            Receivable
          </p>

          <p className="mt-1 truncate text-[10px] font-extrabold text-slate-800">
            {formatCurrency(insights.outstanding)}
          </p>
        </div>

        <div className="rounded-xl border border-white bg-white/70 px-3 py-2 backdrop-blur">
          <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
            Profit
          </p>

          <p className="mt-1 truncate text-[10px] font-extrabold text-slate-800">
            {formatCurrency(insights.projectedProfit)}
          </p>
        </div>
      </div>
    </div>

    {/* RIGHT — DONUT */}
    <div
      className="
        group relative overflow-hidden rounded-3xl
        border border-slate-200 bg-white
        p-4
        transition-all duration-300
        hover:-translate-y-0.5
        hover:border-cyan-200
        hover:shadow-[0_14px_30px_rgba(6,182,212,0.10)]
      "
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            Collection Rate
          </p>

          <p className="mt-1 text-xs font-bold text-slate-800">
            Invoice payments
          </p>
        </div>

        <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.65)]" />
      </div>

      {/* Donut */}
      <div className="mt-5 flex justify-center">
        <div className="relative h-40 w-40">
          <svg
            viewBox="0 0 120 120"
            className="h-full w-full -rotate-90"
          >
            <defs>
              <linearGradient
                id="collectionDonut"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0891b2" />
              </linearGradient>
            </defs>

            <circle
              cx="60"
              cy="60"
              r="47"
              fill="none"
              stroke="#ecfeff"
              strokeWidth="10"
            />

            <circle
              cx="60"
              cy="60"
              r="47"
              fill="none"
              stroke="url(#collectionDonut)"
              strokeWidth="10"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={
                100 -
                Math.min(
                  Math.max(insights.collectionRate, 0),
                  100,
                )
              }
              className="transition-all duration-1000"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black tracking-tight text-slate-950">
              {insights.collectionRate}%
            </span>

            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Collected
            </span>
          </div>
        </div>
      </div>

      {/* Donut Legend */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-cyan-50/70 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />

            <span className="text-[9px] font-semibold text-slate-500">
              Collected
            </span>
          </div>

          <span className="text-[10px] font-extrabold text-slate-800">
            {formatCurrency(insights.collected)}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-300" />

            <span className="text-[9px] font-semibold text-slate-500">
              Receivable
            </span>
          </div>

          <span className="text-[10px] font-extrabold text-slate-800">
            {formatCurrency(insights.outstanding)}
          </span>
        </div>
      </div>
    </div>
  </div>

  {/* Bottom Financial Stats */}
  <div className="grid border-t border-slate-100 bg-slate-50/40 sm:grid-cols-3">
    <div className="border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-white sm:border-b-0 sm:border-r">
      <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
        Receivable
      </p>

      <p className="mt-1 text-sm font-extrabold text-slate-900">
        {formatCurrency(insights.outstanding)}
      </p>

      <p className="mt-1 text-[9px] font-semibold text-rose-500">
        {insights.overdueInvoices} overdue
      </p>
    </div>

    <div className="border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-white sm:border-b-0 sm:border-r">
      <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
        Production Margin
      </p>

      <p className="mt-1 text-sm font-extrabold text-slate-900">
        {insights.averageMargin}%
      </p>

      <p className="mt-1 text-[9px] font-semibold text-cyan-600">
        Average margin
      </p>
    </div>

    <div className="px-4 py-3.5 transition-colors hover:bg-white">
      <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-400">
        Projected Profit
      </p>

      <p className="mt-1 text-sm font-extrabold text-slate-900">
        {formatCurrency(insights.projectedProfit)}
      </p>

      <p className="mt-1 text-[9px] font-semibold text-emerald-600">
        Current projection
      </p>
    </div>
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
   <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <CardHeader
    icon={Boxes}
    title="Production orders"
    description="Recent styles and delivery status"
    href="/production"
    linkLabel="View all"
  />

  {orders.length === 0 ? (
    <CompactEmpty
      icon={Factory}
      text="No production orders yet."
      href="/production"
      action="Start production"
    />
  ) : (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* Table Header */}
        <div
          className="
            grid
            grid-cols-[2fr_1.1fr_.8fr_1fr_.9fr_40px]
            items-center
            gap-3
            border-b
            border-slate-200
            bg-slate-50
            px-4
            py-2.5
          "
        >
          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            Style / Order
          </span>

          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            Quantity
          </span>

          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            Progress
          </span>

          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            Due Date
          </span>

          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
            Status
          </span>

          <span />
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {orders.slice(0, 5).map((order) => (
            <Link
              key={order.id}
              href="/production"
              className="
                group
                relative
                grid
                grid-cols-[2fr_1.1fr_.8fr_1fr_.9fr_40px]
                items-center
                gap-3
                bg-white
                px-4
                py-3.5
                transition-all
                duration-300

                hover:z-10
                hover:bg-blue-50/40
                hover:shadow-[0_8px_24px_rgba(37,99,235,0.08)]
              "
            >
              {/* Left hover indicator */}
              <div
                className="
                  absolute
                  bottom-2
                  left-0
                  top-2
                  w-[3px]
                  scale-y-0
                  rounded-r-full
                  bg-blue-600
                  transition-transform
                  duration-300
                  group-hover:scale-y-100
                "
              />

              {/* Style / Order */}
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-blue-100
                    bg-blue-50
                    text-blue-600
                    transition-all
                    duration-300

                    group-hover:scale-105
                    group-hover:border-blue-200
                    group-hover:bg-blue-600
                    group-hover:text-white
                    group-hover:shadow-md
                  "
                >
                  <Shirt aria-hidden="true" size={17} />
                </span>

                <div className="min-w-0">
                  <p
                    className="
                      truncate
                      text-xs
                      font-extrabold
                      text-slate-900
                      transition-colors
                      group-hover:text-blue-700
                    "
                  >
                    {order.styleName}
                  </p>

                  <p className="mt-1 truncate text-[9px] font-medium text-slate-400">
                    {order.orderNumber}
                    {order.party?.name && ` · ${order.party.name}`}
                  </p>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <p className="text-xs font-extrabold text-slate-800">
                  {order.orderedQty.toLocaleString("en-IN")}
                </p>

                <p className="mt-0.5 text-[9px] font-medium text-slate-400">
                  pieces
                </p>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-blue-700">
                    {order.summary?.progressPercent ?? 0}%
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="
                      h-full
                      rounded-full
                      bg-blue-600
                      transition-all
                      duration-700
                    "
                    style={{
                      width: `${Math.min(
                        order.summary?.progressPercent ?? 0,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <p className="text-[10px] font-bold text-slate-700">
                  {formatDate(order.dueDate)}
                </p>

                <p className="mt-0.5 text-[9px] text-slate-400">
                  Delivery date
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center">
                <StatusBadge status={order.status} />
              </div>

              {/* Arrow */}
              <div className="flex justify-end">
                <span
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-sm
                    font-bold
                    text-slate-400
                    transition-all
                    duration-300

                    group-hover:translate-x-1
                    group-hover:border-blue-200
                    group-hover:bg-blue-600
                    group-hover:text-white
                    group-hover:shadow-sm
                  "
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
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
   <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  {/* Header */}
  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3.5">
    <div>
      <h2 className="text-sm font-extrabold text-slate-950">
        Business Pulse
      </h2>

      <p className="mt-0.5 text-[10px] font-medium text-slate-500">
        Masters and attention items
      </p>
    </div>

    <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
      Overview
    </div>
  </div>

  {/* Pulse Cards */}
  <div className="grid grid-cols-2 gap-3 p-3.5">
    {pulse.map(({ label, value, icon: Icon, color, href }, index) => (
      <Link
        key={label}
        href={href}
        className="
          group
          relative
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-3.5
          shadow-[0_3px_12px_rgba(15,23,42,0.04)]
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-blue-200
          hover:shadow-[0_14px_30px_rgba(15,23,42,0.10)]
        "
      >
        {/* Soft hover shape */}
        <div
          className="
            pointer-events-none
            absolute
            -right-8
            -top-8
            h-24
            w-24
            rounded-full
            bg-blue-100/50
            opacity-0
            blur-2xl
            transition-opacity
            duration-300
            group-hover:opacity-100
          "
        />

        {/* Top */}
        <div className="relative flex items-start justify-between">
          <span
            className={clsx(
              `
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                transition-all
                duration-300
                group-hover:scale-110
              `,
              color,
            )}
          >
            <Icon aria-hidden="true" size={16} />
          </span>

          <span className="text-[9px] font-black text-slate-300">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Value */}
        <div className="relative mt-4">
          <strong className="block text-xl font-black tracking-tight text-slate-950">
            {value}
          </strong>

          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-bold text-slate-500">
              {label}
            </span>

            <span
              className="
                translate-x-1
                text-[11px]
                font-bold
                text-slate-300
                opacity-0
                transition-all
                duration-300
                group-hover:translate-x-0
                group-hover:text-blue-600
                group-hover:opacity-100
              "
            >
              →
            </span>
          </div>
        </div>

        {/* Bottom accent */}
        <div
          className="
            absolute
            bottom-0
            left-0
            h-[3px]
            w-0
            bg-blue-600
            transition-all
            duration-300
            group-hover:w-full
          "
        />
      </Link>
    ))}
  </div>

  {/* Quick Actions */}
  <div className="border-t border-slate-100 bg-white p-4">
  {/* Header */}
  <div className="mb-3 flex items-center justify-between">
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
        Quick Actions
      </p>

      <p className="mt-0.5 text-[9px] text-slate-400">
        Common business operations
      </p>
    </div>

    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">
      Shortcuts
    </span>
  </div>

  {/* Action Buttons */}
  <div className="grid gap-2.5 sm:grid-cols-3">
    {/* Add Party */}
    <Link
      href="/parties"
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-violet-100
        bg-gradient-to-br
        from-violet-50
        via-white
        to-white
        p-3
        shadow-[0_4px_16px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-violet-200
        hover:shadow-[0_14px_30px_rgba(124,58,237,0.12)]
      "
    >
      {/* Glow */}
      <div
        className="
          pointer-events-none
          absolute
          -right-7
          -top-7
          h-20
          w-20
          rounded-full
          bg-violet-200/60
          opacity-0
          blur-2xl
          transition-opacity
          duration-300
          group-hover:opacity-100
        "
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <span
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-violet-600
              text-white
              shadow-[0_6px_16px_rgba(124,58,237,0.25)]
              transition-all
              duration-300
              group-hover:scale-110
              group-hover:rotate-3
            "
          >
            <Users size={17} />
          </span>

          <span
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              border
              border-violet-100
              bg-white
              text-sm
              font-bold
              text-violet-400
              transition-all
              duration-300
              group-hover:translate-x-0.5
              group-hover:bg-violet-600
              group-hover:text-white
            "
          >
            →
          </span>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-extrabold text-slate-900">
            Add Party
          </p>

          <p className="mt-1 text-[9px] leading-4 text-slate-500">
            Create customer or supplier
          </p>
        </div>

        <div className="mt-3 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-violet-500" />
          <span className="text-[8px] font-bold uppercase tracking-wide text-violet-600">
            Create New
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-violet-600 transition-all duration-300 group-hover:w-full" />
    </Link>

    {/* Add Inventory */}
    <Link
      href="/items"
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-amber-100
        bg-gradient-to-br
        from-amber-50
        via-white
        to-white
        p-3
        shadow-[0_4px_16px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-amber-200
        hover:shadow-[0_14px_30px_rgba(245,158,11,0.13)]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          -right-7
          -top-7
          h-20
          w-20
          rounded-full
          bg-amber-200/60
          opacity-0
          blur-2xl
          transition-opacity
          duration-300
          group-hover:opacity-100
        "
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <span
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-amber-500
              text-white
              shadow-[0_6px_16px_rgba(245,158,11,0.25)]
              transition-all
              duration-300
              group-hover:scale-110
              group-hover:-rotate-3
            "
          >
            <Package size={17} />
          </span>

          <span
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              border
              border-amber-100
              bg-white
              text-sm
              font-bold
              text-amber-500
              transition-all
              duration-300
              group-hover:translate-x-0.5
              group-hover:bg-amber-500
              group-hover:text-white
            "
          >
            →
          </span>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-extrabold text-slate-900">
            Add Inventory
          </p>

          <p className="mt-1 text-[9px] leading-4 text-slate-500">
            Create a new stock item
          </p>
        </div>

        <div className="mt-3 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-amber-500" />
          <span className="text-[8px] font-bold uppercase tracking-wide text-amber-600">
            New Item
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
    </Link>

    {/* Invoice */}
    <Link
      href="/invoices/new"
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-emerald-100
        bg-gradient-to-br
        from-emerald-50
        via-white
        to-white
        p-3
        shadow-[0_4px_16px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-emerald-200
        hover:shadow-[0_14px_30px_rgba(16,185,129,0.13)]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          -right-7
          -top-7
          h-20
          w-20
          rounded-full
          bg-emerald-200/60
          opacity-0
          blur-2xl
          transition-opacity
          duration-300
          group-hover:opacity-100
        "
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <span
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-emerald-600
              text-white
              shadow-[0_6px_16px_rgba(16,185,129,0.25)]
              transition-all
              duration-300
              group-hover:scale-110
              group-hover:rotate-3
            "
          >
            <ReceiptText size={17} />
          </span>

          <span
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              border
              border-emerald-100
              bg-white
              text-sm
              font-bold
              text-emerald-500
              transition-all
              duration-300
              group-hover:translate-x-0.5
              group-hover:bg-emerald-600
              group-hover:text-white
            "
          >
            →
          </span>
        </div>

        <div className="mt-3">
          <p className="text-[11px] font-extrabold text-slate-900">
            Create Invoice
          </p>

          <p className="mt-1 text-[9px] leading-4 text-slate-500">
            Generate a new sales invoice
          </p>
        </div>

        <div className="mt-3 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-600">
            New Invoice
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-emerald-600 transition-all duration-300 group-hover:w-full" />
    </Link>
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
