'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleDollarSign, Plus, Search } from 'lucide-react';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { BusinessDocument, PurchasePayment } from '@/types';

const METHODS = [['cash', 'Cash'], ['bank_transfer', 'Bank transfer'], ['upi', 'UPI'], ['cheque', 'Cheque'], ['other', 'Other']] as const;
const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentOutRegister() {
  const [rows, setRows] = useState<PurchasePayment[]>([]);
  const [bills, setBills] = useState<BusinessDocument[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [payments, purchaseBills] = await Promise.all([
        getAllPages<PurchasePayment>('/documents/payments/register'),
        getAllPages<BusinessDocument>('/documents', { params: { type: 'PURCHASE_INVOICE' } }),
      ]);
      setRows(payments.data);
      setBills(purchaseBills.data.filter((bill) => !['DRAFT', 'CANCELLED'].includes(bill.status) && Number(bill.grandTotal) > Number(bill.paidAmount || 0)));
    } catch (loadError) { setError(getApiError(loadError, 'Could not load payment-out records.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? rows.filter(({ document, method, reference }) => [document.documentNumber, document.referenceNumber, document.supplier?.name, method, reference].some((value) => value?.toLowerCase().includes(term))) : rows;
  }, [query, rows]);
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const outstanding = bills.reduce((sum, bill) => sum + Number(bill.grandTotal) - Number(bill.paidAmount || 0), 0);

  return <><PageHeader eyebrow="Purchase Management" title="Payment Out" description="Record money paid to suppliers against issued purchase bills." action={<button type="button" onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={16} />Record payment</button>} />
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><Metric label="Payments" value={rows.length.toLocaleString('en-IN')} /><Metric label="Outstanding payable" value={formatCurrency(outstanding)} /><Metric label="Total paid" value={formatCurrency(total)} wide /></div>
    <section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Payment Out register</h2><p className="mt-0.5 text-[10px] text-slate-400">Supplier payments for the active company and branch</p></div><div className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search payment out" className="input-field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bill, supplier, method, reference..." /></div></div>
      {loading ? <LoadingState label="Loading payments..." /> : error ? <ErrorState message={error} onRetry={load} /> : filtered.length === 0 ? <EmptyState icon={CircleDollarSign} title="No outgoing payments" description={query ? 'Try a different search.' : 'Record a supplier payment against an issued purchase bill.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Purchase bill</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => { const paid = Number(row.document.paidAmount || 0) >= Number(row.document.grandTotal); return <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-3.5 text-slate-500">{formatDate(row.paidAt)}</td><td className="px-5 py-3.5"><Link href={`/documents/${row.document.id}`} className="font-bold text-blue-700 hover:underline">{row.document.referenceNumber || row.document.documentNumber}</Link></td><td className="px-5 py-3.5 font-semibold text-slate-700">{row.document.supplier?.name || 'Not assigned'}</td><td className="px-5 py-3.5 capitalize text-slate-600">{row.method.replaceAll('_', ' ')}</td><td className="px-5 py-3.5 text-slate-500">{row.reference || '—'}</td><td className="px-5 py-3.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{paid ? 'Paid' : 'Partially paid'}</span></td><td className="px-5 py-3.5 text-right font-bold text-red-600">{formatCurrency(row.amount)}</td></tr>; })}</tbody></table></div>}
    </section>{open && <PaymentOutModal bills={bills} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void load(); }} />}</>;
}

function PaymentOutModal({ bills, onClose, onSaved }: { bills: BusinessDocument[]; onClose: () => void; onSaved: () => void }) {
  const [documentId, setDocumentId] = useState(''); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('cash'); const [reference, setReference] = useState(''); const [notes, setNotes] = useState(''); const [paidAt, setPaidAt] = useState(today); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const selected = bills.find(({ id }) => id === documentId); const payable = selected ? Number(selected.grandTotal) - Number(selected.paidAmount || 0) : 0;
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!selected || saving) return; const value = Number(amount); if (!Number.isFinite(value) || value <= 0 || value > payable + 0.01) return setError('Enter an amount within the outstanding payable.'); setSaving(true); setError(''); try { await api.post(`/documents/${documentId}/payments`, { amount: value, method, reference: reference.trim() || undefined, notes: notes.trim() || undefined, paidAt }); onSaved(); } catch (saveError) { setError(getApiError(saveError, 'Could not record payment.')); } finally { setSaving(false); } }
  return <Modal title="Record Payment Out" onClose={onClose} size="lg"><form onSubmit={submit} className="space-y-4">{error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}<Field label="Purchase bill *"><select required className="input-field" value={documentId} onChange={(event) => { const bill = bills.find(({ id }) => id === event.target.value); setDocumentId(event.target.value); setAmount(bill ? String(Number(bill.grandTotal) - Number(bill.paidAmount || 0)) : ''); }}><option value="">Select outstanding purchase bill</option>{bills.map((bill) => <option key={bill.id} value={bill.id}>{bill.referenceNumber || bill.documentNumber} · {bill.supplier?.name || 'Supplier'} · Due {formatCurrency(Number(bill.grandTotal) - Number(bill.paidAmount || 0))}</option>)}</select></Field>{selected && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800"><ArrowUpRight size={16} className="mb-1" />Previous payable: <strong>{formatCurrency(payable)}</strong><span className="float-right">Remaining: <strong>{formatCurrency(Math.max(0, payable - (Number(amount) || 0)))}</strong></span></div>}<div className="grid gap-3 sm:grid-cols-2"><Field label="Amount paid *"><input required type="number" min="0.01" max={payable || undefined} step="0.01" className="input-field" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label="Payment date *"><input required type="date" className="input-field" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></Field><Field label="Payment method *"><select className="input-field" value={method} onChange={(event) => setMethod(event.target.value)}>{METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Reference / transaction ID"><input maxLength={191} className="input-field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR or cheque number" /></Field></div><Field label="Notes"><textarea rows={2} maxLength={5000} className="input-field resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional payment note" /></Field><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button disabled={saving || !selected} className="btn-primary">{saving ? 'Saving...' : 'Save payment'}</button></div></form></Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }
function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 text-xl font-extrabold text-slate-950">{value}</p></div>; }
