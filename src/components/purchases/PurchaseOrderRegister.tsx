'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Party, ProductionOrder, ProductionOrderStatus, Supplier } from '@/types';

type Filter = 'ALL' | 'OPEN' | 'OVERDUE' | ProductionOrderStatus;

export default function PurchaseOrderRegister() {
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
      const [{ data }, { data: partyData }, { data: supplierData }] = await Promise.all([getAllPages<ProductionOrder>('/production-orders'), getAllPages<Party>('/parties'), getAllPages<Supplier>('/suppliers')]);
      setOrders(data.filter((order) => Boolean(order.supplier)));
      setParties(partyData); setSuppliers(supplierData);
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load purchase orders.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);
  const today = new Date().toISOString().slice(0, 10);
  const isOpen = (order: ProductionOrder) => !['COMPLETED', 'CANCELLED'].includes(order.status);
  const isOverdue = (order: ProductionOrder) => Boolean(order.dueDate && order.dueDate.slice(0, 10) < today && isOpen(order));
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => (filter === 'ALL' || (filter === 'OPEN' && isOpen(order)) || (filter === 'OVERDUE' && isOverdue(order)) || order.status === filter) && (!term || [order.orderNumber, order.supplier?.name, order.styleName, order.fabricName].some((value) => value?.toLowerCase().includes(term))));
  }, [filter, orders, query, today]);
  const materialValue = orders.reduce((sum, order) => sum + (order.summary?.materialCost || 0), 0);

  return <><PageHeader title="Purchase Orders" description="Create and track supplier-linked orders for active business projects." action={<button type="button" onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={16} />Create purchase order</button>} /><div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><Metric label="Supplier orders" value={orders.length.toLocaleString('en-IN')} /><Metric label="Open orders" value={orders.filter(isOpen).length.toLocaleString('en-IN')} /><Metric label="Material value" value={formatCurrency(materialValue)} wide /></div><section className="card overflow-hidden"><div className="border-b border-slate-100 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Purchase order register</h2><p className="text-[10px] text-slate-400">{filtered.length} supplier-linked orders</p></div><div className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search purchase orders" value={query} onChange={(e) => setQuery(e.target.value)} className="input-field pl-9" placeholder="Order, supplier, style, material..." /></div></div><div className="mt-3 flex gap-1 overflow-x-auto">{(['ALL', 'OPEN', 'OVERDUE', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'COMPLETED'] as Filter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{value.replaceAll('_', ' ')}</button>)}</div></div>{loading ? <LoadingState label="Loading purchase orders..." /> : error ? <ErrorState message={error} onRetry={loadOrders} /> : filtered.length === 0 ? <EmptyState icon={ClipboardList} title="No purchase orders found" description={query || filter !== 'ALL' ? 'Try changing the filters.' : 'Create your first supplier purchase order.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Project / Style</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Order value</th><th className="px-4 py-3 text-right">Material cost</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((order) => <tr key={order.id} className="hover:bg-blue-50/30"><td className="px-4 py-3.5"><Link href={`/production?orderId=${order.id}`} className="font-bold text-blue-700 hover:underline">{order.orderNumber}</Link></td><td className="px-4 py-3.5 font-semibold">{order.supplier?.name}</td><td className="px-4 py-3.5"><p className="font-semibold">{order.styleName}</p><p className="text-[10px] text-slate-400">{order.fabricName || 'Material not specified'}</p></td><td className={`px-4 py-3.5 ${isOverdue(order) ? 'font-bold text-red-600' : 'text-slate-500'}`}>{order.dueDate ? formatDate(order.dueDate) : '—'}</td><td className="px-4 py-3.5"><StatusBadge status={order.status} /></td><td className="px-4 py-3.5 text-right font-bold">{formatCurrency(Number(order.saleRate) * order.orderedQty)}</td><td className="px-4 py-3.5 text-right font-bold">{formatCurrency(order.summary?.materialCost || 0)}</td></tr>)}</tbody></table></div>}</section>{showCreate && <PurchaseOrderModal parties={parties} suppliers={suppliers} onClose={() => setShowCreate(false)} onSaved={(order) => { setOrders((current) => [order, ...current]); setShowCreate(false); }} />}</>;
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">{value}</p></div>;
}

function PurchaseOrderModal({ parties, suppliers, onClose, onSaved }: { parties: Party[]; suppliers: Supplier[]; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const now = new Date();
  const [form, setForm] = useState({ orderNumber: `PO-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`, partyId: '', supplierId: '', styleName: '', fabricName: '', fabricGsm: '', color: '', orderedQty: '', saleRate: '', dueDate: '', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (saving) return; setSaving(true); setError(''); try { const { data } = await api.post<ProductionOrder>('/production-orders', { ...form, fabricName: form.fabricName.trim() || undefined, fabricGsm: form.fabricGsm.trim() || undefined, color: form.color.trim() || undefined, dueDate: form.dueDate || undefined, notes: form.notes.trim() || undefined, styleName: form.styleName.trim(), orderedQty: Number(form.orderedQty), saleRate: Number(form.saleRate) }); onSaved(data); } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not create the purchase order.')); } finally { setSaving(false); } }
  return <Modal title="Create purchase order" onClose={onClose} size="lg"><form onSubmit={submit} className="space-y-4">{error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}{(!parties.length || !suppliers.length) && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Add at least one customer and supplier before creating a purchase order.</div>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Order number *"><input required autoFocus maxLength={60} className="input-field" value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} /></Field><Field label="Supplier *"><select required className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Related customer *"><select required className="input-field" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}><option value="">Select customer</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></Field><Field label="Product / style *"><input required maxLength={150} className="input-field" value={form.styleName} onChange={(e) => setForm({ ...form, styleName: e.target.value })} /></Field><Field label="Material / fabric"><input maxLength={150} className="input-field" value={form.fabricName} onChange={(e) => setForm({ ...form, fabricName: e.target.value })} /></Field><Field label="GSM / specification"><input maxLength={50} className="input-field" value={form.fabricGsm} onChange={(e) => setForm({ ...form, fabricGsm: e.target.value })} /></Field><Field label="Colour"><input maxLength={150} className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field><Field label="Quantity *"><input required min="1" step="1" type="number" className="input-field" value={form.orderedQty} onChange={(e) => setForm({ ...form, orderedQty: e.target.value })} /></Field><Field label="Sale rate / unit *"><input required min="0" step="0.01" type="number" className="input-field" value={form.saleRate} onChange={(e) => setForm({ ...form, saleRate: e.target.value })} /></Field><Field label="Due date"><input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field></div><Field label="Notes"><textarea rows={2} maxLength={5000} className="input-field resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving || !parties.length || !suppliers.length} className="btn-primary min-w-32">{saving ? 'Creating...' : 'Create order'}</button></div></form></Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
