'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, Boxes, CircleDollarSign, Download, IndianRupee, RefreshCw, TrendingUp, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { BusinessDocument, Invoice, Item, Party, ProductionOrder } from '@/types';

type Range = '30D' | '90D' | 'YEAR' | 'ALL';

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [range, setRange] = useState<Range>('YEAR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [invoiceRes, documentRes, orderRes, partyRes, itemRes] = await Promise.all([
        getAllPages<Invoice>('/invoices'), getAllPages<BusinessDocument>('/documents'), getAllPages<ProductionOrder>('/production-orders'), getAllPages<Party>('/parties'), getAllPages<Item>('/items'),
      ]);
      setInvoices(invoiceRes.data); setDocuments(documentRes.data); setOrders(orderRes.data); setParties(partyRes.data); setItems(itemRes.data);
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not prepare reports.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadReports(); }, [loadReports]);

  const report = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (range === '30D') cutoff.setDate(now.getDate() - 30);
    if (range === '90D') cutoff.setDate(now.getDate() - 90);
    if (range === 'YEAR') cutoff.setMonth(0, 1);
    cutoff.setHours(0, 0, 0, 0);
    const inRange = (value: string) => range === 'ALL' || new Date(value) >= cutoff;
    const activeInvoices = invoices.filter((invoice) => invoice.status !== 'CANCELLED' && inRange(invoice.issueDate));
    const purchaseDocs = documents.filter((document) => document.type === 'PURCHASE_INVOICE' && document.status !== 'CANCELLED' && inRange(document.issueDate));
    const sales = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0);
    const collected = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid), 0);
    const purchases = purchaseDocs.reduce((sum, document) => sum + Number(document.grandTotal), 0);
    const productionCost = orders.filter((order) => inRange(order.createdAt)).reduce((sum, order) => sum + Number(order.summary?.totalMakingCost || 0), 0);
    const byStatus = ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'DRAFT'].map((status) => ({ status, count: activeInvoices.filter((invoice) => invoice.status === status).length, total: activeInvoices.filter((invoice) => invoice.status === status).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0) }));
    const customerMap = new Map<string, { name: string; total: number; paid: number; count: number }>();
    activeInvoices.forEach((invoice) => { const current = customerMap.get(invoice.party.id) ?? { name: invoice.party.name, total: 0, paid: 0, count: 0 }; current.total += Number(invoice.grandTotal); current.paid += Number(invoice.amountPaid); current.count += 1; customerMap.set(invoice.party.id, current); });
    const topCustomers = [...customerMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const months = Array.from({ length: 6 }, (_, index) => { const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1); const next = new Date(date.getFullYear(), date.getMonth() + 1, 1); return { label: date.toLocaleDateString('en-IN', { month: 'short' }), value: invoices.filter((invoice) => invoice.status !== 'CANCELLED' && new Date(invoice.issueDate) >= date && new Date(invoice.issueDate) < next).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0) }; });
    return { sales, collected, outstanding: Math.max(0, sales - collected), purchases, productionCost, profit: sales - purchases - productionCost, byStatus, topCustomers, months };
  }, [documents, invoices, orders, range]);

  const lowStock = items.filter((item) => Number(item.stockQty) <= 5).sort((a, b) => Number(a.stockQty) - Number(b.stockQty)).slice(0, 6);
  const maxMonth = Math.max(...report.months.map(({ value }) => value), 1);

  function exportReport() {
    const rows = [['Metric', 'Value'], ['Sales', report.sales], ['Collected', report.collected], ['Outstanding', report.outstanding], ['Purchases', report.purchases], ['Production cost', report.productionCost], ['Estimated profit', report.profit], ['Parties', parties.length], ['Inventory items', items.length]];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `business-report-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <PageHeader title="Reports" description="Sales, collections, costs, customers, and inventory performance in one workspace." action={<div className="flex gap-2"><button type="button" onClick={() => void loadReports()} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={15} />Refresh</button><button type="button" onClick={exportReport} disabled={loading || Boolean(error)} className="btn-primary inline-flex items-center gap-2"><Download size={15} />Export CSV</button></div>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div><p className="text-xs font-bold text-slate-800">Reporting period</p><p className="text-[10px] text-slate-400">Financial values update with the selected period</p></div><div className="flex gap-1">{(['30D', '90D', 'YEAR', 'ALL'] as Range[]).map((value) => <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${range === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value === '30D' ? '30 days' : value === '90D' ? '90 days' : value === 'YEAR' ? 'This year' : 'All time'}</button>)}</div></div>
    {loading ? <section className="card"><LoadingState label="Generating business reports..." /></section> : error ? <section className="card"><ErrorState message={error} onRetry={loadReports} /></section> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><ReportCard icon={TrendingUp} label="Net sales" value={formatCurrency(report.sales)} tone="blue" /><ReportCard icon={CircleDollarSign} label="Collected" value={formatCurrency(report.collected)} tone="emerald" /><ReportCard icon={IndianRupee} label="Outstanding" value={formatCurrency(report.outstanding)} tone="red" /><ReportCard icon={BarChart3} label="Estimated profit" value={formatCurrency(report.profit)} tone={report.profit >= 0 ? 'violet' : 'red'} /></div>
      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><section className="card p-5"><div className="mb-5"><h2 className="text-sm font-extrabold text-slate-900">Six-month sales trend</h2><p className="text-xs text-slate-400">Invoice value by issue month</p></div><div className="flex h-52 items-end gap-3">{report.months.map((month) => <div key={month.label} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"><span className="mb-2 truncate text-[9px] font-bold text-slate-500">{formatCurrency(month.value)}</span><div className="mx-auto w-full max-w-14 rounded-t-lg bg-blue-500 transition-all" style={{ height: `${Math.max(4, month.value / maxMonth * 155)}px` }} /><span className="mt-2 text-[10px] font-bold text-slate-500">{month.label}</span></div>)}</div></section><section className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-extrabold text-slate-900">Payment status</h2><p className="text-xs text-slate-400">Invoice distribution</p></div><div className="divide-y divide-slate-100">{report.byStatus.map((row) => <div key={row.status} className="grid grid-cols-[1fr_42px_110px] items-center px-5 py-3 text-xs"><span className="font-bold capitalize text-slate-700">{row.status.toLowerCase().replaceAll('_', ' ')}</span><span className="text-center text-slate-500">{row.count}</span><span className="text-right font-extrabold">{formatCurrency(row.total)}</span></div>)}</div></section></div>
      <div className="grid gap-4 xl:grid-cols-2"><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-extrabold text-slate-900">Top customers</h2><p className="text-xs text-slate-400">Ranked by invoiced value</p></div><Link href="/parties" className="text-xs font-bold text-blue-600">View parties</Link></div>{report.topCustomers.length ? <div className="divide-y divide-slate-100">{report.topCustomers.map((customer, index) => <div key={customer.name} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-5 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">{index + 1}</span><div><p className="text-xs font-bold text-slate-800">{customer.name}</p><p className="text-[10px] text-slate-400">{customer.count} invoices · {formatCurrency(customer.paid)} paid</p></div><p className="text-sm font-extrabold">{formatCurrency(customer.total)}</p></div>)}</div> : <EmptyPanel label="No customer sales in this period" />}</section><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><AlertTriangle size={16} className="text-amber-500" />Low-stock items</h2><p className="text-xs text-slate-400">Five units or fewer</p></div><Link href="/items" className="text-xs font-bold text-blue-600">View inventory</Link></div>{lowStock.length ? <div className="divide-y divide-slate-100">{lowStock.map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-xs font-bold text-slate-800">{item.name}</p><p className="text-[10px] text-slate-400">{item.sku || 'No SKU'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${Number(item.stockQty) <= 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{Number(item.stockQty).toLocaleString('en-IN')} {item.unit}</span></div>)}</div> : <EmptyPanel label="Inventory levels look healthy" />}</section></div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><SmallMetric icon={Users} label="Parties" value={parties.length.toLocaleString('en-IN')} /><SmallMetric icon={Boxes} label="Inventory units" value={items.reduce((sum, item) => sum + Number(item.stockQty), 0).toLocaleString('en-IN')} /><SmallMetric icon={IndianRupee} label="Purchases" value={formatCurrency(report.purchases)} /><SmallMetric icon={BarChart3} label="Production cost" value={formatCurrency(report.productionCost)} /></div>
    </>}
  </>;
}

const TONES = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600', violet: 'bg-violet-50 text-violet-600' };
function ReportCard({ icon: Icon, label, value, tone }: { icon: typeof BarChart3; label: string; value: string; tone: keyof typeof TONES }) { return <div className="card p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}><Icon size={17} /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-950">{value}</p></div>; }
function SmallMetric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <div className="card flex items-center gap-3 p-3.5"><Icon size={17} className="shrink-0 text-blue-600" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="truncate text-sm font-extrabold">{value}</p></div></div>; }
function EmptyPanel({ label }: { label: string }) { return <div className="px-5 py-10 text-center text-xs text-slate-400">{label}</div>; }
