'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, CircleDollarSign, FileText, Package, Plus, RefreshCw, TriangleAlert, Wallet } from 'lucide-react';
import DashboardTrend from './DashboardTrend';
import StatusBadge from './StatusBadge';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { multiplyMoney, sumMoney } from '@/lib/billing';
import { buildDashboardSeries, invoiceBalance } from '@/lib/dashboard';
import { inDateRange, localDate, type buildBusinessReport, type ReportDates } from '@/lib/business-report';
import type { BusinessDocument, Expense, Invoice, Item, Party } from '@/types';

type Props = {
  invoices: Invoice[]; documents: BusinessDocument[]; expenses: Expense[]; items: Item[]; parties: Party[];
  report: ReturnType<typeof buildBusinessReport>; dates: ReportDates; range: string; from: string; to: string;
  onRange: (value: string) => void; onFrom: (value: string) => void; onTo: (value: string) => void;
  onRefresh: () => void; lowStockThreshold: number;
};

const expenseColors = ['#2348c8', '#f5b700', '#7c9cf0', '#0f1a3a'];

export default function ReferenceHome({ invoices, documents, expenses, items, parties, report, dates, range, from, to, onRange, onFrom, onTo, onRefresh, lowStockThreshold }: Props) {
  const points = useMemo(() => buildDashboardSeries(invoices, documents, dates), [invoices, documents, dates]);
  const active = invoices.filter(invoice => !['DRAFT', 'CANCELLED'].includes(invoice.status));
  const periodInvoices = active.filter(invoice => inDateRange(invoice.issueDate, dates));
  const recent = [...periodInvoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 5);
  const receivable = sumMoney(parties.map(party => Math.max(0, Number(party.balanceDue ?? 0))));
  const low = items.filter(item => Number(item.stockQty) <= Number(item.lowStockThreshold ?? lowStockThreshold));
  const stockValue = sumMoney(items.map(item => multiplyMoney(item.stockQty, item.purchasePrice ?? 0)));
  const overdue = active.filter(invoice => invoice.dueDate && invoice.dueDate.slice(0, 10) < localDate() && invoiceBalance(invoice) > 0);
  const collectedRate = report.grossSales > 0 ? Math.max(0, Math.min(100, Math.round(report.collected / report.grossSales * 100))) : 0;
  const costs = new Map<string, number>();
  for (const expense of expenses.filter(expense => expense.status === 'ISSUED' && inDateRange(expense.expenseDate, dates))) {
    costs.set(expense.category || 'General', sumMoney([costs.get(expense.category || 'General') ?? 0, expense.total]));
  }
  if (report.productionCost > 0) costs.set('Production costs', sumMoney([costs.get('Production costs') ?? 0, report.productionCost]));
  const sorted = [...costs].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const expenseMix = sorted.length > 4 ? [...sorted.slice(0, 3), ['Other expenses', sumMoney(sorted.slice(3).map(([, value]) => value))] as [string, number]] : sorted;
  const totalCosts = sumMoney(expenseMix.map(([, value]) => value));
  let circleOffset = 0;

  return (
    <div className="brand-dashboard">
      <header className="brand-dashboard-heading">
        <div><p className="brand-eyebrow"><span /> YOUR BUSINESS, AT A GLANCE</p><h1>Business overview<span>.</span></h1><p>A clear view of your sales, spending, and what needs attention.</p></div>
        <div className="brand-dashboard-actions"><button type="button" className="brand-refresh" aria-label="Refresh dashboard" onClick={onRefresh}><RefreshCw size={17} /></button><Link href="/invoices/new" className="brand-primary"><Plus size={17} /> Create invoice</Link></div>
      </header>

      <div className="brand-period-bar">
        <div><CalendarDays size={17} /><span>Overview for</span><select aria-label="Dashboard period" value={range} onChange={event => onRange(event.target.value)}><option value="TODAY">Today</option><option value="WEEK">This week</option><option value="MONTH">This month</option><option value="YEAR">This year</option><option value="ALL">All time</option><option value="CUSTOM">Custom dates</option></select></div>
        {range === 'CUSTOM' ? <div className="brand-custom-dates"><label>From<input aria-label="Dashboard from date" type="date" value={from} max={to} onChange={event => onFrom(event.target.value)} /></label><label>To<input aria-label="Dashboard to date" type="date" value={to} min={from} onChange={event => onTo(event.target.value)} /></label></div> : <span className="brand-date-caption">{dates.from ? formatDate(dates.from + 'T12:00:00') : 'First recorded activity'} <ArrowRight size={13} /> {formatDate((dates.to ?? localDate()) + 'T12:00:00')}</span>}
      </div>

      <section className="brand-kpis" aria-label="Business summary">
        <article className="brand-kpi featured"><div><span>Net sales</span><span className="brand-kpi-icon"><ChartNoAxesCombined size={20} /></span></div><strong>{formatCurrency(report.sales)}</strong><p><span className="brand-mini-dot" />{periodInvoices.length} issued invoice{periodInvoices.length === 1 ? '' : 's'} in this period</p><Link href="/invoices" aria-label="View sales invoices"><ArrowUpRight size={19} /></Link></article>
        <article className="brand-kpi"><div><span>Receivables</span><span className="brand-kpi-icon"><ArrowDownLeft size={20} /></span></div><strong>{formatCurrency(receivable)}</strong><p>Current balance · {parties.filter(party => Number(party.balanceDue) > 0).length} customers</p><Link href="/parties" aria-label="View customer balances"><ArrowUpRight size={19} /></Link></article>
        <article className="brand-kpi"><div><span>Supplier payables</span><span className="brand-kpi-icon"><Wallet size={19} /></span></div><strong>{formatCurrency(report.payable)}</strong><p>Outstanding bills in this period</p><Link href="/purchases/bills" aria-label="View supplier bills"><ArrowUpRight size={19} /></Link></article>
        <article className="brand-kpi"><div><span>Operating expenses</span><span className="brand-kpi-icon"><CircleDollarSign size={20} /></span></div><strong>{formatCurrency(sumMoney([report.expenses, report.productionCost]))}</strong><p>General expenses + production costs</p><Link href="/purchases/expenses" aria-label="View expenses"><ArrowUpRight size={19} /></Link></article>
      </section>

      <div className="brand-analytics-grid">
        <DashboardTrend points={points} />
        <section className="brand-panel brand-expense-panel" aria-label="Expense breakdown">
          <div className="brand-panel-heading"><div><p className="brand-eyebrow">WHERE IT GOES</p><h2>Expense breakdown</h2></div><Link href="/purchases/expenses" aria-label="View all expenses"><ArrowUpRight size={19} /></Link></div>
          <div className="brand-donut"><svg viewBox="0 0 200 200" role="img" aria-label={`Operating expenses ${formatCurrency(totalCosts)}; ${expenseMix.map(([label, value]) => `${label} ${formatCurrency(value)}`).join(', ') || 'no expenses in this period'}`}><circle cx="100" cy="100" r="75" fill="none" stroke="#ebedf2" strokeWidth="21" />{expenseMix.map(([label, value], index) => {
            const share = totalCosts ? value / totalCosts * 100 : 0;
            const offset = circleOffset; circleOffset += share;
            return <circle key={label} cx="100" cy="100" r="75" fill="none" stroke={expenseColors[index]} strokeWidth="21" pathLength="100" strokeDasharray={`${Math.max(0, share - (share === 100 ? 0 : 1.4))} ${100 - Math.max(0, share - (share === 100 ? 0 : 1.4))}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)" />;
          })}</svg><div><span>Total expenses</span><strong>{formatCurrency(totalCosts)}</strong><small>Selected period</small></div></div>
          <div className="brand-expense-legend">{expenseMix.map(([label, value], index) => <div key={label}><span><i style={{ background: expenseColors[index] }} />{label}</span><strong>{formatCurrency(value)}</strong></div>)}{!expenseMix.length && <p>No recorded expenses for this period.</p>}</div>
          <div className="brand-collection"><div><span>Invoice collection</span><strong>{collectedRate}%</strong></div><div className="brand-progress" role="progressbar" aria-label="Invoice collection rate" aria-valuenow={collectedRate} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${collectedRate}%` }} /></div><p>{formatCurrency(report.collected)} collected against {formatCurrency(report.grossSales)} invoiced</p></div>
        </section>
      </div>

      <div className="brand-activity-grid">
        <section className="brand-panel brand-recent"><div className="brand-panel-heading"><div><p className="brand-eyebrow">LATEST ACTIVITY</p><h2>Recent invoices</h2></div><Link href="/invoices" className="brand-text-link">View all <ArrowRight size={15} /></Link></div><div className="brand-data-scroll"><table><caption className="sr-only">Recent issued invoices in the selected period</caption><thead><tr><th>Invoice / Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{recent.map(invoice => <tr key={invoice.id}><td><Link href={'/invoices/' + invoice.id}><strong>{invoice.party.name}</strong><span>{invoice.invoiceNumber}</span></Link></td><td>{formatDate(invoice.issueDate)}</td><td className="brand-money">{formatCurrency(invoice.grandTotal)}</td><td><StatusBadge status={invoice.status} /></td></tr>)}</tbody></table>{!recent.length && <div className="brand-empty"><FileText size={25} /><strong>No invoices in this period</strong><span>Create an invoice or choose a different date range.</span><Link href="/invoices/new" className="brand-text-link">Create your first invoice <ArrowRight size={14} /></Link></div>}</div></section>
        <aside className="brand-attention"><div className="brand-attention-heading"><TriangleAlert size={18} /><h2>Needs your attention</h2></div><Link href="/invoices?status=overdue" className="brand-attention-row"><span className="brand-attention-icon"><FileText size={19} /></span><span><strong>{overdue.length} overdue invoice{overdue.length === 1 ? '' : 's'}</strong><small>{formatCurrency(sumMoney(overdue.map(invoiceBalance)))} awaiting payment</small></span><ArrowUpRight size={17} /></Link><Link href="/items" className="brand-attention-row"><span className="brand-attention-icon"><Package size={19} /></span><span><strong>{low.length} low-stock item{low.length === 1 ? '' : 's'}</strong><small>{low.length ? low.slice(0, 2).map(item => `${item.name} (${formatQuantity(item.stockQty)})`).join(', ') : 'Stock levels are above your thresholds'}</small></span><ArrowUpRight size={17} /></Link><div className="brand-stock-value"><span>Current inventory value</span><strong>{formatCurrency(stockValue)}</strong><small>At recorded purchase prices</small></div></aside>
      </div>

      <section className="brand-report-shortcuts" aria-label="Quick reports"><div><p className="brand-eyebrow">GO A LITTLE DEEPER</p><h2>Your business reports</h2></div><div>{[['Sales report', '/reports?report=sale'], ['All transactions', '/reports?report=all'], ['Day book', '/reports?report=daybook'], ['Party statement', '/reports?report=party']].map(([label, href]) => <Link key={href} href={href}>{label}<ArrowUpRight size={16} /></Link>)}</div></section>
    </div>
  );
}
