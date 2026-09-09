'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleDollarSign, Plus, ReceiptIndianRupee, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ProductionCost, ProductionCostCategory, ProductionOrder, Supplier } from '@/types';

type CostRow = ProductionCost & { orderId: string; orderNumber: string; orderDate: string };
const CATEGORIES: ProductionCostCategory[] = ['FABRIC', 'COLLAR_RIB', 'ACCESSORIES', 'LABELS', 'TAGS', 'POLY_BAGS', 'BUTTONS', 'CARTONS', 'TRANSPORT', 'OTHER'];

export default function ProductionCostRegister({ mode }: { mode: 'expenses' | 'payment-out' }) {
  const paymentMode = mode === 'payment-out';
  const title = paymentMode ? 'Payment-Out' : 'Expenses';
  const [rows, setRows] = useState<CostRow[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | ProductionCostCategory>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [{ data }, { data: supplierData }] = await Promise.all([getAllPages<ProductionOrder>('/production-orders'), getAllPages<Supplier>('/suppliers')]);
      setOrders(data); setSuppliers(supplierData);
      const costs = data.flatMap((order) => order.costs.map((cost) => ({ ...cost, orderId: order.id, orderNumber: order.orderNumber, orderDate: order.createdAt })));
      setRows(paymentMode ? costs.filter((cost) => Number(cost.paidAmount) > 0) : costs);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, `Could not load ${title.toLowerCase()}.`));
    } finally { setLoading(false); }
  }, [paymentMode, title]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => (category === 'ALL' || row.category === category) && (!term || [row.description, row.category, row.orderNumber, row.supplier?.name].some((value) => value?.toLowerCase().includes(term))));
  }, [category, query, rows]);
  const total = rows.reduce((sum, row) => sum + Number(paymentMode ? row.paidAmount : row.amount), 0);
  const outstanding = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) - Number(row.paidAmount)), 0);
  const Icon = paymentMode ? CircleDollarSign : ReceiptIndianRupee;

  return <><PageHeader title={title} description={paymentMode ? 'Review recorded supplier and production payments made from the business.' : 'Track material, labour, transport, and other project-linked business costs.'} action={paymentMode ? <Link href="/production" className="btn-primary inline-flex items-center gap-2"><ArrowUpRight size={16} />Open production costs</Link> : <button type="button" onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={16} />Add expense</button>} /><div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><Metric label={paymentMode ? 'Payment records' : 'Expense records'} value={rows.length.toLocaleString('en-IN')} /><Metric label={paymentMode ? 'Total paid' : 'Total expenses'} value={formatCurrency(total)} /><Metric label="Outstanding" value={formatCurrency(outstanding)} wide /></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-sm font-bold text-slate-900">{title} register</h2><p className="text-[10px] text-slate-400">{filtered.length} project-based cost records</p></div><div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><select aria-label="Filter expense category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="input-field sm:w-44"><option value="ALL">All categories</option>{CATEGORIES.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select><div className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label={`Search ${title}`} value={query} onChange={(e) => setQuery(e.target.value)} className="input-field pl-9" placeholder="Description, project or supplier..." /></div></div></div>{loading ? <LoadingState label={`Loading ${title.toLowerCase()}...`} /> : error ? <ErrorState message={error} onRetry={loadRows} /> : filtered.length === 0 ? <EmptyState icon={Icon} title={`No ${title.toLowerCase()} found`} description={query || category !== 'ALL' ? 'Try changing the filters.' : 'Add your first project expense.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Due</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => { const due = Math.max(0, Number(row.amount) - Number(row.paidAmount)); return <tr key={row.id} className="hover:bg-blue-50/30"><td className="px-4 py-3.5 font-semibold text-slate-800">{row.description}</td><td className="px-4 py-3.5 text-xs text-slate-500">{labelize(row.category)}</td><td className="px-4 py-3.5"><Link href={`/production?orderId=${row.orderId}`} className="font-bold text-blue-700 hover:underline">{row.orderNumber}</Link></td><td className="px-4 py-3.5 text-slate-600">{row.supplier?.name || 'Not assigned'}</td><td className="px-4 py-3.5 text-slate-500">{formatDate(row.orderDate)}</td><td className="px-4 py-3.5 text-right font-bold">{formatCurrency(row.amount)}</td><td className="px-4 py-3.5 text-right text-emerald-700">{formatCurrency(row.paidAmount)}</td><td className={`px-4 py-3.5 text-right font-bold ${due ? 'text-red-600' : 'text-slate-400'}`}>{formatCurrency(due)}</td></tr>; })}</tbody></table></div>}</section>{showCreate && <ExpenseModal orders={orders} suppliers={suppliers} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); void loadRows(); }} />}</>;
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">{value}</p></div>;
}

function ExpenseModal({ orders, suppliers, onClose, onSaved }: { orders: ProductionOrder[]; suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ orderId: '', category: 'OTHER' as ProductionCostCategory, description: '', supplierId: '', quantity: '1', rate: '', paidAmount: '0', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amount = Number(form.quantity) * Number(form.rate);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try {
      await api.post(`/production-orders/${form.orderId}/costs`, { category: form.category, description: form.description.trim(), supplierId: form.supplierId || undefined, quantity: Number(form.quantity), rate: Number(form.rate), amount, paidAmount: Math.min(Number(form.paidAmount), amount), notes: form.notes.trim() || undefined });
      onSaved();
    } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not add the expense.')); }
    finally { setSaving(false); }
  }
  return <Modal title="Add expense" onClose={onClose} size="lg"><form onSubmit={submit} className="space-y-4">{error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}{!orders.length && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Create a sales or production order before adding a project expense.</div>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Project / order *"><select required autoFocus className="input-field" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}><option value="">Select order</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.styleName}</option>)}</select></Field><Field label="Category *"><select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductionCostCategory })}>{CATEGORIES.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select></Field><Field label="Description *"><input required maxLength={180} className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Transport, fabric, labour..." /></Field><Field label="Supplier"><select className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Not assigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Quantity *"><input required min="0.001" step="0.001" type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field><Field label="Rate *"><input required min="0" step="0.01" type="number" className="input-field" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field><Field label="Amount paid"><input min="0" max={amount || undefined} step="0.01" type="number" className="input-field" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></Field><div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Expense total<strong className="float-right text-base">{formatCurrency(amount)}</strong></div></div><Field label="Notes"><textarea rows={2} className="input-field resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving || !orders.length} className="btn-primary min-w-28">{saving ? 'Saving...' : 'Save expense'}</button></div></form></Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
function labelize(value: string) { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
