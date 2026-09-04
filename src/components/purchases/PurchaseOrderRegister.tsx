'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ProductionOrder } from '@/types';

export default function PurchaseOrderRegister() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await getAllPages<ProductionOrder>('/production-orders');
      setOrders(data.filter((order) => Boolean(order.supplier)));
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load purchase orders.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? orders.filter((order) => [order.orderNumber, order.supplier?.name, order.styleName, order.fabricName].some((value) => value?.toLowerCase().includes(term))) : orders;
  }, [orders, query]);
  const materialValue = orders.reduce((sum, order) => sum + (order.summary?.materialCost || 0), 0);

  return <><PageHeader title="Purchase Orders" description="Track supplier-linked material and production orders for active business projects." action={<Link href="/production" className="btn-primary inline-flex items-center gap-2"><Plus aria-hidden="true" size={16} />Create order</Link>} /><div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><Metric label="Supplier orders" value={orders.length.toLocaleString('en-IN')} /><Metric label="Open orders" value={orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)).length.toLocaleString('en-IN')} /><Metric label="Material value" value={formatCurrency(materialValue)} wide /></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Purchase order register</h2><p className="mt-0.5 text-[10px] text-slate-400">Supplier-linked project and production orders</p></div><div className="relative w-full sm:w-80"><Search aria-hidden="true" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search purchase orders" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field pl-9" placeholder="Search order, supplier, style, material..." /></div></div>{loading ? <LoadingState label="Loading purchase orders..." /> : error ? <ErrorState message={error} onRetry={loadOrders} /> : filtered.length === 0 ? <EmptyState icon={ClipboardList} title="No purchase orders found" description={query ? 'Try a different search.' : 'Create a production order and assign a supplier to show it here.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Order</th><th className="px-5 py-3 font-semibold">Supplier</th><th className="px-5 py-3 font-semibold">Project / Style</th><th className="px-5 py-3 font-semibold">Due date</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Material cost</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((order) => <tr key={order.id} className="hover:bg-slate-50/80"><td className="px-5 py-3.5"><Link href="/production" className="font-bold text-blue-700 hover:underline">{order.orderNumber}</Link></td><td className="px-5 py-3.5 font-semibold text-slate-700">{order.supplier?.name}</td><td className="px-5 py-3.5"><p className="font-semibold text-slate-700">{order.styleName}</p><p className="mt-0.5 text-[10px] text-slate-400">{order.fabricName || 'Material not specified'}</p></td><td className="px-5 py-3.5 text-slate-500">{order.dueDate ? formatDate(order.dueDate) : '\u2014'}</td><td className="px-5 py-3.5"><StatusBadge status={order.status} /></td><td className="px-5 py-3.5 text-right font-bold text-slate-900">{formatCurrency(order.summary?.materialCost || 0)}</td></tr>)}</tbody></table></div>}</section></>;
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">{value}</p></div>;
}
