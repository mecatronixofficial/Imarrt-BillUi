'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Boxes, CircleDollarSign, TrendingUp, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Invoice, Item, Party } from '@/types';

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadReports = useCallback(async () => { setLoading(true); setError(''); try { const [invoiceResponse, partyResponse, itemResponse] = await Promise.all([getAllPages<Invoice>('/invoices'), getAllPages<Party>('/parties'), getAllPages<Item>('/items')]); setInvoices(invoiceResponse.data); setParties(partyResponse.data); setItems(itemResponse.data); } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not prepare reports.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void loadReports(); }, [loadReports]);
  const report = useMemo(() => { const active = invoices.filter(({ status }) => status !== 'CANCELLED'); const sales = active.reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0); const collected = active.reduce((sum, invoice) => sum + Number(invoice.amountPaid), 0); const byStatus = ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'DRAFT'].map((status) => ({ status, count: invoices.filter((invoice) => invoice.status === status).length, total: invoices.filter((invoice) => invoice.status === status).reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0) })); return { sales, collected, outstanding: Math.max(0, sales - collected), byStatus }; }, [invoices]);
  return <><PageHeader title="Reports" description="Sales, collections, receivables, parties, and inventory at a glance." />{loading ? <section className="card"><LoadingState label="Generating business reports..." /></section> : error ? <section className="card"><ErrorState message={error} onRetry={loadReports} /></section> : <><div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><ReportCard icon={TrendingUp} label="Net sales" value={formatCurrency(report.sales)} /><ReportCard icon={CircleDollarSign} label="Collected" value={formatCurrency(report.collected)} /><ReportCard icon={Users} label="Parties" value={parties.length.toLocaleString('en-IN')} /><ReportCard icon={Boxes} label="Inventory units" value={items.reduce((sum, item) => sum + Number(item.stockQty), 0).toLocaleString('en-IN')} /></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><section className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-extrabold text-slate-900">Sales by payment status</h2><p className="mt-0.5 text-xs text-slate-400">Current invoice distribution</p></div><div className="divide-y divide-slate-100">{report.byStatus.map((row) => <div key={row.status} className="grid grid-cols-[1fr_80px_140px] items-center px-5 py-3.5 text-sm"><span className="font-bold capitalize text-slate-700">{row.status.toLowerCase().replace('_', ' ')}</span><span className="text-center text-slate-500">{row.count}</span><span className="text-right font-extrabold text-slate-900">{formatCurrency(row.total)}</span></div>)}</div></section><section className="rounded-2xl bg-slate-950 p-5 text-white"><BarChart3 size={22} className="text-blue-300" /><p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Outstanding receivables</p><p className="mt-1 text-2xl font-extrabold">{formatCurrency(report.outstanding)}</p><p className="mt-3 text-xs leading-5 text-slate-400">Review party balances and send payment reminders directly from the Parties workspace.</p><Link href="/parties" className="mt-5 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500">Open parties</Link></section></div></>}</>;
}

function ReportCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <div className="card p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={17} /></span><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold text-slate-950">{value}</p></div>; }
