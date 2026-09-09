'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ClipboardList, IndianRupee, PackageCheck, Plus, Search, ShoppingBag } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Party, ProductionOrder, ProductionOrderStatus, Supplier } from '@/types';

type Filter = 'ALL' | 'OPEN' | 'OVERDUE' | ProductionOrderStatus;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'ALL', label: 'All' }, { value: 'OPEN', label: 'Open' }, { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'IN_PRODUCTION', label: 'In production' },
  { value: 'READY', label: 'Ready' }, { value: 'DISPATCHED', label: 'Dispatched' }, { value: 'COMPLETED', label: 'Completed' },
];

export default function SalesOrderRegister() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [{ data: orderData }, { data: partyData }, { data: supplierData }] = await Promise.all([
        getAllPages<ProductionOrder>('/production-orders'), getAllPages<Party>('/parties'), getAllPages<Supplier>('/suppliers'),
      ]);
      setOrders(orderData); setParties(partyData); setSuppliers(supplierData);
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load sales orders.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const today = new Date().toISOString().slice(0, 10);
  const isOpen = (order: ProductionOrder) => !['COMPLETED', 'CANCELLED'].includes(order.status);
  const isOverdue = (order: ProductionOrder) => Boolean(order.dueDate && order.dueDate.slice(0, 10) < today && isOpen(order));
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !term || [order.orderNumber, order.party?.name, order.styleName, order.fabricName].some((value) => value?.toLowerCase().includes(term));
      const matchesFilter = filter === 'ALL' || (filter === 'OPEN' && isOpen(order)) || (filter === 'OVERDUE' && isOverdue(order)) || order.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [filter, orders, query, today]);
  const totalValue = orders.reduce((sum, order) => sum + Number(order.saleRate) * order.orderedQty, 0);
  const openValue = orders.filter(isOpen).reduce((sum, order) => sum + Number(order.saleRate) * order.orderedQty, 0);

  return <>
    <PageHeader title="Sales Orders" description="Create and track customer orders from confirmation through production and dispatch." action={<button type="button" onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={16} />Create sales order</button>} />
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={ShoppingBag} label="Total orders" value={orders.length.toLocaleString('en-IN')} /><Metric icon={PackageCheck} label="Open orders" value={orders.filter(isOpen).length.toLocaleString('en-IN')} /><Metric icon={CalendarClock} label="Overdue" value={orders.filter(isOverdue).length.toLocaleString('en-IN')} alert /><Metric icon={IndianRupee} label="Open value" value={formatCurrency(openValue)} /></div>
    <section className="card overflow-hidden">
      <div className="border-b border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Sales order register</h2><p className="text-[10px] text-slate-400">Total booked value {formatCurrency(totalValue)}</p></div><div className="relative w-full lg:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search sales orders" value={query} onChange={(e) => setQuery(e.target.value)} className="input-field pl-9" placeholder="Order, customer, style or material..." /></div></div><div className="scrollbar-hide mt-3 flex gap-1 overflow-x-auto" role="tablist">{FILTERS.map((item) => <button key={item.value} type="button" role="tab" aria-selected={filter === item.value} onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === item.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item.label}</button>)}</div></div>
      {loading ? <LoadingState label="Loading sales orders..." /> : error ? <ErrorState message={error} onRetry={loadOrders} /> : filtered.length === 0 ? <EmptyState icon={ClipboardList} title="No sales orders found" description={query || filter !== 'ALL' ? 'Try changing the search or status filter.' : 'Create your first customer sales order.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Product / Style</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Delivery</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((order) => <tr key={order.id} className="hover:bg-blue-50/40"><td className="px-4 py-3.5"><Link href={`/production?orderId=${order.id}`} className="font-bold text-blue-700 hover:underline">{order.orderNumber}</Link></td><td className="px-4 py-3.5 font-semibold text-slate-700">{order.party?.name || 'Not assigned'}</td><td className="px-4 py-3.5"><p className="font-semibold text-slate-800">{order.styleName}</p><p className="text-[10px] text-slate-400">{order.fabricName || 'Material not specified'}</p></td><td className="px-4 py-3.5 text-right font-semibold">{order.orderedQty.toLocaleString('en-IN')}</td><td className={`px-4 py-3.5 ${isOverdue(order) ? 'font-bold text-red-600' : 'text-slate-500'}`}>{order.dueDate ? formatDate(order.dueDate) : '—'}</td><td className="px-4 py-3.5"><StatusBadge status={order.status} /></td><td className="px-4 py-3.5 text-right">{formatCurrency(order.saleRate)}</td><td className="px-4 py-3.5 text-right font-bold">{formatCurrency(Number(order.saleRate) * order.orderedQty)}</td></tr>)}</tbody></table></div>}
    </section>
    {showCreate && <SalesOrderModal parties={parties} suppliers={suppliers} onClose={() => setShowCreate(false)} onSaved={(order) => { setOrders((current) => [order, ...current]); setShowCreate(false); }} />}
  </>;
}

function SalesOrderModal({ parties, suppliers, onClose, onSaved }: { parties: Party[]; suppliers: Supplier[]; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const now = new Date();
  const [form, setForm] = useState({ orderNumber: `SO-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`, partyId: '', supplierId: '', styleName: '', fabricName: '', color: '', orderedQty: '', saleRate: '', dueDate: '', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const total = Number(form.orderedQty) * Number(form.saleRate);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (saving) return; setSaving(true); setError(''); try { const { data } = await api.post<ProductionOrder>('/production-orders', { ...form, supplierId: form.supplierId || undefined, fabricName: form.fabricName.trim() || undefined, color: form.color.trim() || undefined, dueDate: form.dueDate || undefined, notes: form.notes.trim() || undefined, styleName: form.styleName.trim(), orderedQty: Number(form.orderedQty), saleRate: Number(form.saleRate) }); onSaved(data); } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not create the sales order.')); } finally { setSaving(false); } }
  return <Modal title="Create sales order" onClose={onClose} size="lg"><form onSubmit={submit} className="space-y-4">{error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}{!parties.length && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Add a customer in Parties before creating an order.</div>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Order number *"><input required autoFocus maxLength={60} className="input-field" value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} /></Field><Field label="Customer *"><select required className="input-field" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}><option value="">Select customer</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></Field><Field label="Primary supplier"><select className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Not assigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Product / style *"><input required maxLength={150} className="input-field" value={form.styleName} onChange={(e) => setForm({ ...form, styleName: e.target.value })} /></Field><Field label="Material / fabric"><input maxLength={150} className="input-field" value={form.fabricName} onChange={(e) => setForm({ ...form, fabricName: e.target.value })} /></Field><Field label="Colour"><input maxLength={150} className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field><Field label="Quantity *"><input required min="1" step="1" type="number" className="input-field" value={form.orderedQty} onChange={(e) => setForm({ ...form, orderedQty: e.target.value })} /></Field><Field label="Sale rate / unit *"><input required min="0" step="0.01" type="number" className="input-field" value={form.saleRate} onChange={(e) => setForm({ ...form, saleRate: e.target.value })} /></Field><Field label="Delivery date"><input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field></div><Field label="Notes"><textarea rows={2} maxLength={5000} className="input-field resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Order value <strong className="float-right text-sm">{formatCurrency(total)}</strong></div><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving || !parties.length} className="btn-primary min-w-32">{saving ? 'Creating...' : 'Create order'}</button></div></form></Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
function Metric({ icon: Icon, label, value, alert = false }: { icon: typeof ShoppingBag; label: string; value: string; alert?: boolean }) { return <div className="card flex items-center gap-3 p-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${alert ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}><Icon size={18} /></span><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className={`block truncate text-lg font-extrabold ${alert ? 'text-red-700' : 'text-slate-950'}`}>{value}</span></span></div>; }
