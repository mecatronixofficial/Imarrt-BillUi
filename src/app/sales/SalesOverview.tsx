'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CircleAlert, Clock3, FileText, IndianRupee, Loader2, Plus, ReceiptText, RefreshCw, TrendingUp, Trophy, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';
import { formatCompact, type ChartPoint, type RecordRow, type StatusSegment, type Tone } from '@/components/workspace/WorkspaceKit';
import styles from './SalesOverview.module.css';

type Props = {
  loading: boolean;
  error: string;
  onRefresh: () => void;
  summary: { sales: number; received: number; outstanding: number; monthSales: number; salesChange: number | null; collectionRate: number; overdueAmount: number; quotationValue: number; openOrders: number };
  estimateCount: number;
  overdueCount: number;
  trend: ChartPoint[];
  status: StatusSegment[];
  customers: Array<{ name: string; billed: number; due: number; count: number }>;
  recent: RecordRow[];
  overdue: RecordRow[];
  registers: Array<{ href: string; label: string; description: string; icon: LucideIcon; tone: Tone; stat: string; statLabel: string }>;
};

function Panel({ title, description, icon: Icon, href, action, children, className = '', id }: { title: string; description: string; icon: LucideIcon; href?: string; action?: string; children: ReactNode; className?: string; id?: string }) {
  return <section className={`${styles.panel} ${className}`} id={id} aria-label={title}>
    <header className={styles.panelHeader}><div className={styles.panelTitle}><span className={styles.panelIcon}><Icon size={18} aria-hidden="true" /></span><div><h2>{title}</h2><p>{description}</p></div></div>{href && <Link href={href} className={styles.textLink}>{action || 'View all'}<ArrowUpRight size={14} aria-hidden="true" /></Link>}</header>
    {children}
  </section>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function Records({ rows, empty, attention = false }: { rows: RecordRow[]; empty: string; attention?: boolean }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return <ul className={styles.records}>{rows.map((row) => <li key={row.id}><Link href={row.href}>
    <span className={`${styles.recordIcon} ${attention ? styles.attentionIcon : ''}`}>{attention ? <Clock3 size={16} aria-hidden="true" /> : <ReceiptText size={16} aria-hidden="true" />}</span>
    <div className={styles.recordLabel}><strong>{row.title}</strong><small>{row.subtitle}</small></div>
    <div className={styles.recordValue}><strong>{row.value}</strong>{row.badge && <span data-tone={row.badge.tone} className={styles.badge}>{row.badge.label}</span>}</div><ArrowUpRight size={14} className={styles.rowArrow} aria-hidden="true" />
  </Link></li>)}</ul>;
}

function SalesChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map(({ value }) => value), 0);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return <div className={styles.chartContent}>
    <div className={styles.chartHeadline}><div><span>Invoiced in the last 6 months</span><strong>{formatCurrency(total)}</strong></div><span className={styles.chartLegend}><i /> Invoiced sales</span></div>
    {max > 0 ? <div className={styles.chart} role="group" aria-label="Monthly invoiced sales">
      <div className={styles.chartAxis} aria-hidden="true"><span>{formatCompact(max)}</span><span>{formatCompact(max / 2)}</span><span>₹0</span></div>
      <div className={styles.plot}><div className={styles.gridLines} aria-hidden="true"><i /><i /><i /></div><div className={styles.columns}>{points.map((point, index) => <div className={styles.column} key={`${point.label}-${index}`}>
        <div className={styles.barArea}><button type="button" className={styles.barButton} aria-label={`${point.label}: ${formatCurrency(point.value)}`} data-current={index === points.length - 1 || undefined}><span className={styles.bar} style={{ height: `${Math.max(0, point.value / max) * 100}%` }} /></button><span className={styles.chartTooltip}>{point.label} · {formatCurrency(point.value)}</span></div><span className={styles.month}>{point.label}</span>
      </div>)}</div></div>
    </div> : <div className={styles.chartEmpty}><BarChart3 size={32} strokeWidth={1.4} aria-hidden="true" /><p>No sales recorded in the last 6 months.</p></div>}
    <details className={styles.chartDetails}><summary>View monthly figures <ArrowRight size={13} aria-hidden="true" /></summary><table><caption className={styles.srOnly}>Invoiced sales by month</caption><thead><tr><th scope="col">Month</th><th scope="col">Sales</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.label}-${index}`}><th scope="row">{point.label}</th><td>{formatCurrency(point.value)}</td></tr>)}</tbody></table></details>
  </div>;
}

function InvoiceStatus({ segments }: { segments: StatusSegment[] }) {
  const colors = { emerald: '#29a68b', amber: '#f0bd42', red: '#e38b92', slate: '#d9e0ed', blue: '#5f7fd4' };
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  let start = 0;
  const stops = segments.map((segment) => { const end = start + (total ? segment.count / total * 100 : 0); const stop = `${colors[segment.tone]} ${start}% ${end}%`; start = end; return stop; });
  return <div className={styles.statusContent}>
    <div className={styles.donut} style={{ background: total ? `conic-gradient(${stops.join(',')})` : '#edf1f7' }} role="img" aria-label={total ? segments.map(({ label, count }) => `${label}: ${count}`).join(', ') : 'No invoices yet'}><div><strong>{total}</strong><span>Total invoices</span></div></div>
    <ul className={styles.statusLegend}>{segments.map(({ label, count, amount, tone }) => <li key={label}><span className={styles.statusDot} style={{ backgroundColor: colors[tone] }} /><span>{label}</span><strong>{count}</strong><small>{amount || '—'}</small></li>)}</ul>
    <p className={styles.statusNote}>{total ? 'A complete view of your invoice activity.' : 'Create your first invoice to start tracking sales.'}</p>
  </div>;
}

export default function SalesOverview({ loading, error, onRefresh, summary, estimateCount, overdueCount, trend, status, customers, recent, overdue, registers }: Props) {
  const maxCustomer = Math.max(...customers.map(({ billed }) => billed), 1);
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.heading}><span className={styles.heroIcon}><TrendingUp size={28} strokeWidth={1.7} aria-hidden="true" /></span><div><p className={styles.eyebrow}>SALES / OVERVIEW</p><h1>Sales command centre</h1><p className={styles.subtitle}>Your sales, collections and customer activity. All in one place.</p></div></div><div className={styles.headerActions}><button type="button" className={styles.iconButton} disabled={loading} onClick={onRefresh} aria-label="Refresh sales overview" title="Refresh sales overview"><RefreshCw size={17} className={loading ? styles.spin : undefined} aria-hidden="true" /></button><Link href="/sales/quotations/new" className={styles.secondaryButton}><FileText size={16} aria-hidden="true" /> Estimate</Link><Link href="/invoices/new" className={styles.primaryButton}><Plus size={17} aria-hidden="true" /> New invoice</Link></div></header>
    <div className={styles.intro}><span><i /> Live sales overview</span><span>All-time figures <span aria-hidden="true">·</span> Current company</span></div>

    {loading ? <div className={styles.state} role="status"><Loader2 size={28} className={styles.spin} aria-hidden="true" /><h2>Preparing your sales overview</h2><p>Loading invoices, collections and customer activity...</p></div> : error ? <div className={`${styles.state} ${styles.error}`} role="alert"><CircleAlert size={29} aria-hidden="true" /><h2>Could not load sales</h2><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" /> Retry</button></div> : <>
      <section className={styles.metrics} aria-label="Sales summary">
        <article className={styles.metric}><div className={styles.metricLabel}><span className={styles.metricIcon}><IndianRupee size={20} aria-hidden="true" /></span><span>Total sales</span></div><strong data-sales-metric="sales">{formatCurrency(summary.sales)}</strong><p><span>{formatCurrency(summary.monthSales)} this month</span>{summary.salesChange !== null && <span className={styles.change} data-negative={summary.salesChange < 0 || undefined} title="Change in sales compared with last month">{summary.salesChange < 0 ? <ArrowDownRight size={12} aria-hidden="true" /> : <ArrowUpRight size={12} aria-hidden="true" />}{Math.abs(summary.salesChange).toFixed(0)}%<span className={styles.srOnly}>{summary.salesChange < 0 ? ' decrease' : ' increase'} compared with last month</span></span>}</p></article>
        <article className={styles.metric}><div className={styles.metricLabel}><span className={`${styles.metricIcon} ${styles.greenIcon}`}><Wallet size={20} aria-hidden="true" /></span><span>Payments received</span></div><strong data-sales-metric="received">{formatCurrency(summary.received)}</strong><p>{summary.collectionRate}% of invoiced sales collected</p><div className={styles.collectionTrack} role="img" aria-label={`${summary.collectionRate}% collection rate`}><span style={{ width: `${summary.collectionRate}%` }} /></div></article>
        <article className={styles.metric}><div className={styles.metricLabel}><span className={`${styles.metricIcon} ${styles.amberIcon}`}><Clock3 size={20} aria-hidden="true" /></span><span>Outstanding</span></div><strong data-sales-metric="outstanding">{formatCurrency(summary.outstanding)}</strong><p><span>{overdueCount} overdue · {formatCurrency(summary.overdueAmount)}</span>{overdueCount > 0 && <a href="#sales-attention" className={styles.attentionLink} aria-label="View overdue invoices"><ArrowUpRight size={15} aria-hidden="true" /></a>}</p></article>
        <article className={styles.metric}><div className={styles.metricLabel}><span className={`${styles.metricIcon} ${styles.violetIcon}`}><FileText size={20} aria-hidden="true" /></span><span>Open estimates</span></div><strong data-sales-metric="estimates">{estimateCount}</strong><p>{formatCurrency(summary.quotationValue)} quoted · {summary.openOrders} open orders</p></article>
      </section>

      <div className={styles.analysisGrid}>
        <Panel title="Sales trend" description="Monthly invoiced sales over the last 6 months" icon={BarChart3} href="/invoices" action="All invoices"><SalesChart points={trend} /></Panel>
        <Panel title="Invoice status" description="Where your invoices stand" icon={ReceiptText}><InvoiceStatus segments={status} /></Panel>
      </div>

      <div className={styles.activityGrid}>
        <Panel title="Top customers" description="Your leading customers by billed value" icon={Trophy} href="/parties/details" action="Parties">{customers.length ? <ol className={styles.customers}>{customers.map((customer, index) => <li key={`${customer.name}-${index}`}><div className={styles.customerTop}><span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span><div><strong>{customer.name}</strong><small>{customer.count} invoice{customer.count === 1 ? '' : 's'} · {formatCurrency(customer.due)} due</small></div><b>{formatCurrency(customer.billed)}</b></div><div className={styles.customerTrack}><span style={{ width: `${Math.max(0, customer.billed / maxCustomer * 100)}%` }} /></div></li>)}</ol> : <Empty>Customers appear here once you create invoices.</Empty>}</Panel>
        <Panel title="Recent invoices" description="The latest from your sales desk" icon={ReceiptText} href="/invoices"><Records rows={recent} empty="No invoices yet." /></Panel>
        <Panel title="Needs attention" description="Overdue payments to follow up" icon={Clock3} className={styles.attentionPanel} id="sales-attention"><div className={styles.attentionSummary}><span>{overdueCount} overdue invoice{overdueCount === 1 ? '' : 's'}</span><strong>{formatCurrency(summary.overdueAmount)}</strong></div><Records rows={overdue} empty="No overdue payments. You’re all caught up." attention /></Panel>
      </div>

      <section className={styles.registerSection} aria-labelledby="sale-workspace-heading"><header><div><p className={styles.eyebrow}>YOUR DAILY WORKSPACE</p><h2 id="sale-workspace-heading">Keep your sales moving</h2><p>Choose a register to get straight to work.</p></div><span className={styles.registerCount}>{registers.length} registers</span></header><div className={styles.registerGrid}>{registers.map(({ href, label, description, icon: Icon, tone, stat, statLabel }) => <Link key={href} href={href} className={styles.register} data-tone={tone}><div className={styles.registerTop}><span className={styles.registerIcon}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.registerArrow}><ArrowUpRight size={17} aria-hidden="true" /></span></div><h3>{label}</h3><p>{description}</p><div className={styles.registerStat}><strong>{stat}</strong><span>{statLabel}</span></div></Link>)}</div></section>
    </>}
  </div>;
}
