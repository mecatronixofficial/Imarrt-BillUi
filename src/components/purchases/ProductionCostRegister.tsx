'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleDollarSign, ReceiptIndianRupee, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ProductionCost, ProductionOrder } from '@/types';

type CostRow = ProductionCost & { orderId: string; orderNumber: string; orderDate: string };

export default function ProductionCostRegister({ mode }: { mode: 'expenses' | 'payment-out' }) {
  const paymentMode = mode === 'payment-out';
  const title = paymentMode ? 'Payment-Out' : 'Expenses';
  const [rows, setRows] = useState<CostRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await getAllPages<ProductionOrder>('/production-orders');
      const costs = data.flatMap((order) => order.costs.map((cost) => ({ ...cost, orderId: order.id, orderNumber: order.orderNumber, orderDate: order.createdAt })));
      setRows(paymentMode ? costs.filter((cost) => Number(cost.paidAmount) > 0) : costs);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, `Could not load ${title.toLowerCase()}.`));
    } finally { setLoading(false); }
  }, [paymentMode, title]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? rows.filter((row) => [row.description, row.category, row.orderNumber, row.supplier?.name].some((value) => value?.toLowerCase().includes(term))) : rows;
  }, [query, rows]);
  const total = rows.reduce((sum, row) => sum + Number(paymentMode ? row.paidAmount : row.amount), 0);
  const outstanding = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) - Number(row.paidAmount)), 0);
  const Icon = paymentMode ? CircleDollarSign : ReceiptIndianRupee;

  return <><PageHeader title={title} description={paymentMode ? 'Review recorded supplier and production payments made from the business.' : 'Track material, labour, transport, and other project-linked business costs.'} action={<Link href="/production" className="btn-primary inline-flex items-center gap-2"><ArrowUpRight aria-hidden="true" size={16} />Open production costs</Link>} /><div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><Metric label={paymentMode ? 'Payment records' : 'Expense records'} value={rows.length.toLocaleString('en-IN')} /><Metric label={paymentMode ? 'Total paid' : 'Total expenses'} value={formatCurrency(total)} /><Metric label="Outstanding" value={formatCurrency(outstanding)} wide /></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">{title} register</h2><p className="mt-0.5 text-[10px] text-slate-400">Project-based costs from production orders</p></div><div className="relative w-full sm:w-80"><Search aria-hidden="true" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label={`Search ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} className="input-field pl-9" placeholder="Search description, category, supplier..." /></div></div>{loading ? <LoadingState label={`Loading ${title.toLowerCase()}...`} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : filtered.length === 0 ? <EmptyState icon={Icon} title={`No ${title.toLowerCase()} found`} description={query ? 'Try a different search.' : 'Add a cost to a production order to show it in this register.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Description</th><th className="px-5 py-3 font-semibold">Category</th><th className="px-5 py-3 font-semibold">Purchase / Project</th><th className="px-5 py-3 font-semibold">Supplier</th><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 text-right font-semibold">{paymentMode ? 'Paid' : 'Amount'}</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row.id} className="hover:bg-slate-50/80"><td className="px-5 py-3.5 font-semibold text-slate-800">{row.description}</td><td className="px-5 py-3.5 text-xs font-medium text-slate-500">{row.category.replaceAll('_', ' ')}</td><td className="px-5 py-3.5"><Link href="/production" className="font-bold text-blue-700 hover:underline">{row.orderNumber}</Link></td><td className="px-5 py-3.5 text-slate-600">{row.supplier?.name || 'Not assigned'}</td><td className="px-5 py-3.5 text-slate-500">{formatDate(row.orderDate)}</td><td className="px-5 py-3.5 text-right font-bold text-slate-900">{formatCurrency(paymentMode ? row.paidAmount : row.amount)}</td></tr>)}</tbody></table></div>}</section></>;
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">{value}</p></div>;
}
