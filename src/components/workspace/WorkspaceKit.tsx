'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

/* Shared building blocks for the Sales and Purchases dashboards. They follow the home dashboard's look:
   a dark hero, stat cards with a coloured top line, and white panels. One colour per entity: blue = sales,
   orange = purchases, so a chart never changes colour between pages. */

export type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'red' | 'orange' | 'cyan';

const TONES: Record<Tone, { icon: string; line: string; soft: string; text: string }> = {
  blue: { icon: 'bg-blue-50 text-blue-600', line: 'bg-blue-500', soft: 'bg-blue-50', text: 'text-blue-700' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', line: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700' },
  amber: { icon: 'bg-amber-50 text-amber-600', line: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-700' },
  violet: { icon: 'bg-violet-50 text-violet-600', line: 'bg-violet-500', soft: 'bg-violet-50', text: 'text-violet-700' },
  red: { icon: 'bg-red-50 text-red-600', line: 'bg-red-500', soft: 'bg-red-50', text: 'text-red-700' },
  orange: { icon: 'bg-orange-50 text-orange-600', line: 'bg-orange-500', soft: 'bg-orange-50', text: 'text-orange-700' },
  cyan: { icon: 'bg-cyan-50 text-cyan-600', line: 'bg-cyan-500', soft: 'bg-cyan-50', text: 'text-cyan-700' },
};

const SERIES = { blue: '#2a78d6', orange: '#eb6834' } as const;

/* ---------------------------------------------------------------- Hero */

export function HeroBanner({ eyebrow, title, description, actions, accent = 'blue' }: { eyebrow: string; title: string; description: string; actions?: ReactNode; accent?: 'blue' | 'orange' }) {
  const glow = accent === 'orange'
    ? 'bg-[radial-gradient(circle_at_15%_0%,rgba(234,88,12,0.32),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(124,58,237,0.22),transparent_42%)]'
    : 'bg-[radial-gradient(circle_at_15%_0%,rgba(37,99,235,0.35),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(124,58,237,0.24),transparent_42%)]';
  return (
    <header className="relative mb-4 overflow-hidden rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-xl shadow-slate-200 sm:px-6">
      <div className={clsx('pointer-events-none absolute inset-0', glow)} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className={clsx('mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em]', accent === 'orange' ? 'text-orange-300' : 'text-blue-300')}>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.8)]" /> {eyebrow}
          </div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function HeroLink({ href, icon: Icon, children, primary = false }: { href: string; icon: LucideIcon; children: ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={clsx('inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-blue-400', primary ? 'bg-blue-600 shadow-lg shadow-blue-950/40 hover:bg-blue-500' : 'border border-white/15 bg-white/10 hover:bg-white/15')}>
      <Icon aria-hidden="true" size={15} /> {children}
    </Link>
  );
}

/* ---------------------------------------------------------- Stat cards */

export function StatCard({ icon: Icon, label, value, detail, tone, delta, goodWhenUp = true }: { icon: LucideIcon; label: string; value: string; detail: string; tone: Tone; delta?: number | null; goodWhenUp?: boolean }) {
  const style = TONES[tone];
  return (
    <article className="card group relative overflow-hidden p-3.5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-4">
      <span className={clsx('absolute inset-x-0 top-0 h-0.5', style.line)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-1 break-words text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">{value}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
            {delta !== undefined && delta !== null && <DeltaPill value={delta} goodWhenUp={goodWhenUp} />}
            <span>{detail}</span>
          </p>
        </div>
        <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105', style.icon)}><Icon aria-hidden="true" size={18} /></span>
      </div>
    </article>
  );
}

/** Month-on-month change. `goodWhenUp` flips the colour meaning for costs. Always shows an arrow and the number, never colour alone. */
export function DeltaPill({ value, goodWhenUp = true }: { value: number; goodWhenUp?: boolean }) {
  const up = value >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold', good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      <Icon aria-hidden="true" size={10} /> {Math.abs(value).toFixed(0)}%
    </span>
  );
}

/* --------------------------------------------------------------- Panel */

export function Panel({ title, description, icon: Icon, tone = 'blue', action, children, className }: { title: string; description?: string; icon?: LucideIcon; tone?: Tone; action?: { href: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card min-w-0 p-4', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONES[tone].icon)}><Icon aria-hidden="true" size={16} /></span>}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-900">{title}</h2>
            {description && <p className="truncate text-[10px] text-slate-400">{description}</p>}
          </div>
        </div>
        {action && <Link href={action.href} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline">{action.label} <ArrowRight aria-hidden="true" size={11} /></Link>}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">{children}</p>;
}

/* -------------------------------------------------------- Column chart */

export type ChartPoint = { label: string; value: number };

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (value: number) => `₹${compact.format(value)}`;

/** Last `months` calendar months (oldest first) summed by a date and a value. */
export function monthlySeries<T>(records: T[], dateOf: (record: T) => string | undefined, valueOf: (record: T) => number, months = 6): ChartPoint[] {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleString('en-IN', { month: 'short' }), value: 0 };
  });
  for (const record of records) {
    const raw = dateOf(record);
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = buckets.find(({ key }) => key === `${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.value += valueOf(record);
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Columns grow from one baseline, are capped at 24px, round only the data end, and carry a hover tooltip. */
export function ColumnChart({ points, series = 'blue', format, name }: { points: ChartPoint[]; series?: keyof typeof SERIES; format: (value: number) => string; name: string }) {
  const max = Math.max(...points.map(({ value }) => value), 0);
  const color = SERIES[series];
  const total = points.reduce((sum, { value }) => sum + value, 0);
  if (!total) return <EmptyNote>No {name.toLowerCase()} recorded in the last {points.length} months.</EmptyNote>;
  return (
    <div>
      <div className="relative h-44" role="img" aria-label={`${name} by month: ${points.map(({ label, value }) => `${label} ${format(value)}`).join(', ')}`}>
        {[0, 1, 2].map((line) => (
          <div key={line} className="pointer-events-none absolute inset-x-0 border-t border-slate-100" style={{ top: `${line * 33.3}%` }}>
            {line === 0 && <span className="absolute -top-2 left-0 bg-white pr-1 text-[9px] font-semibold text-slate-400">{formatCompact(max)}</span>}
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-5 top-0 flex items-end gap-2 border-b border-slate-300">
          {points.map((point, index) => {
            const height = max ? Math.max(2, (point.value / max) * 100) : 0;
            const current = index === points.length - 1;
            return (
              <div key={point.label + index} className="group relative flex h-full flex-1 items-end justify-center">
                <span className="pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg group-hover:block group-focus-within:block" style={{ bottom: `calc(${height}% + 22px)` }}>{point.label}: {format(point.value)}</span>
                <button type="button" aria-label={`${point.label}: ${format(point.value)}`} className="flex h-full w-full items-end justify-center focus:outline-none">
                  <span className="block w-full max-w-6 rounded-t-[4px] transition group-hover:opacity-80" style={{ height: `${height}%`, backgroundColor: color, opacity: current ? 1 : 0.72 }} />
                </button>
                {current && point.value > 0 && <span className="pointer-events-none absolute text-[9px] font-bold text-slate-700" style={{ bottom: `calc(${height}% + 3px)` }}>{formatCompact(point.value)}</span>}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex gap-2">
          {points.map((point, index) => <span key={point.label + index} className="flex-1 text-center text-[10px] font-semibold text-slate-500">{point.label}</span>)}
        </div>
      </div>
      <details className="mt-2 text-[10px] text-slate-500">
        <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700">View as table</summary>
        <table className="mt-1.5 w-full text-left"><tbody>{points.map((point, index) => <tr key={point.label + index} className="border-t border-slate-100"><td className="py-1">{point.label}</td><td className="py-1 text-right font-semibold text-slate-700">{format(point.value)}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

/* --------------------------------------------------------- Ranked bars */

export type RankedRow = { label: string; sub?: string; value: number; href?: string };

/** Horizontal bars for "who/what is biggest": one series colour, the label and the value both printed. */
export function RankedBars({ rows, series = 'blue', format, empty }: { rows: RankedRow[]; series?: keyof typeof SERIES; format: (value: number) => string; empty: string }) {
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>;
  const max = Math.max(...rows.map(({ value }) => value), 1);
  return (
    <ol className="space-y-3">
      {rows.map((row, index) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs font-semibold text-slate-800"><span className="mr-1.5 text-[10px] font-bold text-slate-300">{index + 1}</span>{row.label}</span>
              <span className="shrink-0 text-xs font-extrabold text-slate-900">{format(row.value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (row.value / max) * 100)}%`, backgroundColor: SERIES[series] }} /></div>
            {row.sub && <p className="mt-1 text-[10px] text-slate-400">{row.sub}</p>}
          </>
        );
        return <li key={row.label + index}>{row.href ? <Link href={row.href} className="block rounded-lg transition hover:bg-slate-50">{body}</Link> : body}</li>;
      })}
    </ol>
  );
}

/* ----------------------------------------------------- Status breakdown */

export type StatusSegment = { label: string; count: number; amount?: string; tone: 'emerald' | 'amber' | 'red' | 'slate' | 'blue'; icon: LucideIcon };

const SEGMENT_FILL: Record<StatusSegment['tone'], string> = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', slate: 'bg-slate-300', blue: 'bg-blue-500' };
const SEGMENT_TEXT: Record<StatusSegment['tone'], string> = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-500', blue: 'text-blue-600' };

/** A stacked bar with a legend that carries icon, label, count and amount, so state is never colour alone. */
export function StatusBreakdown({ segments, empty }: { segments: StatusSegment[]; empty: string }) {
  const total = segments.reduce((sum, { count }) => sum + count, 0);
  if (!total) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={segments.map(({ label, count }) => `${label} ${count}`).join(', ')}>
        {segments.filter(({ count }) => count > 0).map((segment) => <div key={segment.label} className={clsx('h-full', SEGMENT_FILL[segment.tone])} style={{ width: `${(segment.count / total) * 100}%` }} title={`${segment.label}: ${segment.count}`} />)}
      </div>
      <ul className="mt-3 space-y-2">
        {segments.map(({ label, count, amount, tone, icon: Icon }) => (
          <li key={label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600"><span className={clsx('h-2.5 w-2.5 shrink-0 rounded-sm', SEGMENT_FILL[tone])} /><Icon aria-hidden="true" size={13} className={SEGMENT_TEXT[tone]} /><span className="truncate font-semibold">{label}</span></span>
            <span className="shrink-0 text-right"><span className="font-extrabold text-slate-900">{count}</span>{amount && <span className="ml-2 text-[10px] text-slate-400">{amount}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- Record rows */

export type RecordRow = { id: string; href: string; title: string; subtitle: string; value: string; badge?: { label: string; tone: 'emerald' | 'amber' | 'red' | 'slate' | 'blue' } };

const BADGE: Record<NonNullable<RecordRow['badge']>['tone'], string> = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', slate: 'bg-slate-100 text-slate-600', blue: 'bg-blue-50 text-blue-700' };

export function RecordList({ rows, empty }: { rows: RecordRow[]; empty: string }) {
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
            <span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-900">{row.title}</span><span className="block truncate text-[10px] text-slate-400">{row.subtitle}</span></span>
            <span className="shrink-0 text-right"><span className="block text-xs font-extrabold text-slate-900">{row.value}</span>{row.badge && <span className={clsx('mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold', BADGE[row.badge.tone])}>{row.badge.label}</span>}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------ Register cards */

export function RegisterCard({ href, label, description, icon: Icon, tone, stat, statLabel }: { href: string; label: string; description: string; icon: LucideIcon; tone: Tone; stat: string; statLabel: string }) {
  return (
    <Link href={href} className="card group flex min-w-0 min-h-28 items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONES[tone].icon)}><Icon aria-hidden="true" size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] leading-5 text-slate-500">{description}</span>
        <span className="mt-1.5 flex min-w-0 items-baseline gap-1.5"><span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold', TONES[tone].soft, TONES[tone].text)}>{stat}</span><span className="min-w-0 truncate text-[10px] text-slate-400">{statLabel}</span></span>
      </span>
      <ArrowRight aria-hidden="true" size={17} className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
    </Link>
  );
}
