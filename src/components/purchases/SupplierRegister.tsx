'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, FileText, IndianRupee, Pencil, Plus, Search, Trash2, TriangleAlert, Users, X, type LucideIcon } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { toast } from '@/components/ToastProvider';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { buildSupplierSummary } from '@/lib/counterparty-dashboard';
import { formatCurrency } from '@/lib/format';
import type { BusinessDocument, Supplier } from '@/types';
import { usePageState } from '@/lib/navigation';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function SupplierRegister() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<BusinessDocument[]>([]);
  const [billsUnavailable, setBillsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = usePageState('SupplierRegister.query', '');
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [canDelete, setCanDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [supplierResult, billResult] = await Promise.allSettled([
      getAllPages<Supplier>('/suppliers'),
      getAllPages<BusinessDocument>('/documents', { params: { type: 'PURCHASE_INVOICE' } }),
    ]);
    if (supplierResult.status === 'rejected') {
      setError(getApiError(supplierResult.reason, 'Could not load suppliers.'));
    } else {
      setSuppliers(supplierResult.value.data);
    }
    setBills(billResult.status === 'fulfilled' ? billResult.value.data : []);
    setBillsUnavailable(billResult.status === 'rejected');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('create') === '1') setEditing(null);
    void getCurrentUser().then((user) => setCanDelete(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN')).catch(() => setCanDelete(false));
  }, []);

  const summary = useMemo(() => buildSupplierSummary(suppliers, bills), [suppliers, bills]);
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return suppliers
      .filter((supplier) => !term || [supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.gstin].some((value) => value?.toLowerCase().includes(term)))
      .map((supplier) => ({ supplier, stats: summary.byId.get(supplier.id) }))
      .sort((a, b) => (b.stats?.outstanding ?? 0) - (a.stats?.outstanding ?? 0) || a.supplier.name.localeCompare(b.supplier.name));
  }, [suppliers, summary, query]);

  function saved(supplier: Supplier, created: boolean) {
    setSuppliers((current) => created ? [...current, supplier] : current.map((entry) => entry.id === supplier.id ? { ...entry, ...supplier } : entry));
    (created ? toast.success : toast.warning)(created ? 'Supplier added' : 'Supplier updated', { description: supplier.name });
    setEditing(undefined);
  }

  async function confirmDelete() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.delete(`/suppliers/${deleting.id}`);
      setSuppliers((current) => current.filter((entry) => entry.id !== deleting.id));
      toast.danger('Supplier deleted', { description: deleting.name });
      setDeleting(null);
    } catch (deleteFailure) {
      setDeleteError(getApiError(deleteFailure, 'Could not delete this supplier. Suppliers with bills or orders cannot be deleted.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-w-0 p-4 sm:p-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Suppliers</h1>
          <p className="mt-1 text-xs text-slate-500">Everyone you buy fabric, materials and job work from, with what you owe them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/purchases/bills/new" className="btn-secondary inline-flex items-center gap-2"><FileText aria-hidden="true" size={15} />New purchase bill</Link>
          <button type="button" onClick={() => setEditing(null)} className="btn-primary inline-flex items-center gap-2"><Plus aria-hidden="true" size={15} />Add supplier</button>
        </div>
      </header>

      {loading ? <section className="card"><LoadingState label="Loading suppliers..." /></section> : error ? <section className="card"><ErrorState message={error} onRetry={load} /></section> : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Supplier summary">
            <StatTile icon={Users} label="Total suppliers" value={summary.total.toLocaleString('en-IN')} />
            <StatTile icon={FileText} label="Total purchases" value={formatCurrency(summary.periodAmount)} />
            <StatTile icon={IndianRupee} label="Payable" value={formatCurrency(summary.outstanding)} tone="amber" />
            <StatTile icon={TriangleAlert} label="With dues" value={summary.withDues.toLocaleString('en-IN')} tone={summary.withDues ? 'amber' : undefined} />
          </section>

          {billsUnavailable && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">Purchase bills could not be loaded, so purchase and due amounts show as zero. <button type="button" className="font-bold underline" onClick={() => void load()}>Retry</button></p>}

          <section className="card min-w-0 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-500">{rows.length} of {suppliers.length} suppliers</p>
              <div className="relative w-full sm:w-80">
                <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" aria-label="Search suppliers" className="input-field w-full !pl-10" placeholder="Search name, phone or GSTIN" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
            </div>

            {suppliers.length === 0 ? (
              <div className="py-4">
                <EmptyState icon={Building2} title="No suppliers yet" description="Add your fabric, accessory and job-work suppliers to track purchases and dues." />
                <div className="flex justify-center pb-4"><button type="button" onClick={() => setEditing(null)} className="btn-primary inline-flex items-center gap-2"><Plus aria-hidden="true" size={15} />Add supplier</button></div>
              </div>
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No suppliers match your search.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">GSTIN</th>
                      <th className="px-3 py-3 text-right">Bills</th>
                      <th className="px-3 py-3 text-right">Purchases</th>
                      <th className="px-3 py-3 text-right">Due</th>
                      <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ supplier, stats }) => (
                      <tr key={supplier.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                        <td className="max-w-64 px-4 py-3">
                          <strong className="block truncate font-bold text-slate-900">{supplier.name}</strong>
                          <span className="block truncate text-[11px] text-slate-500">{[supplier.contactName, supplier.notes].filter(Boolean).join(' · ') || '—'}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{supplier.phone || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-slate-600">{supplier.gstin || '—'}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-600">{stats?.count ?? 0}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(stats?.periodAmount ?? 0)}</td>
                        <td className={`whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums ${(stats?.outstanding ?? 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{(stats?.outstanding ?? 0) > 0 ? formatCurrency(stats?.outstanding ?? 0) : 'No dues'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button type="button" onClick={() => setEditing(supplier)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil aria-hidden="true" size={13} />Edit</button>
                          {canDelete && <button type="button" onClick={() => { setDeleteError(''); setDeleting(supplier); }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 aria-hidden="true" size={13} />Delete</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {editing !== undefined && <SupplierFormModal supplier={editing} onClose={() => setEditing(undefined)} onSaved={saved} />}
      {deleting && <ConfirmDialog title="Delete supplier?" message={`${deleting.name} will be removed from your supplier list.`} error={deleteError} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={() => void confirmDelete()} />}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: 'amber' }) {
  return (
    <article className="card min-w-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}><Icon aria-hidden="true" size={14} /></span>
      </div>
      <p className="mt-2 truncate text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">{value}</p>
    </article>
  );
}

function SupplierFormModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: (supplier: Supplier, created: boolean) => void }) {
  const [form, setForm] = useState({ name: supplier?.name ?? '', contactName: supplier?.contactName ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', gstin: supplier?.gstin ?? '', address: supplier?.address ?? '', notes: supplier?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const gstin = form.gstin.trim().toUpperCase();
    if (!form.name.trim()) { setError('Enter the supplier name.'); return; }
    if (gstin && !GSTIN_PATTERN.test(gstin)) { setError('Enter a valid 15-character GSTIN.'); return; }
    setSaving(true);
    setError('');
    // When editing, send empty strings so cleared fields are cleared; when creating, omit empty fields.
    const value = (text: string) => text.trim() || (supplier ? '' : undefined);
    const payload = { name: form.name.trim(), contactName: value(form.contactName), phone: value(form.phone), email: form.email.trim().toLowerCase() || undefined, gstin: gstin || (supplier ? '' : undefined), address: value(form.address), notes: value(form.notes) };
    try {
      const { data } = supplier ? await api.patch<Supplier>(`/suppliers/${supplier.id}`, payload) : await api.post<Supplier>('/suppliers', payload);
      onSaved(data, !supplier);
    } catch (saveError) {
      setError(getApiError(saveError, 'Could not save supplier.'));
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="label">{label}</span><input className="input-field" value={form[key]} onChange={(event) => setForm({ ...form, [key]: key === 'gstin' ? event.target.value.toUpperCase() : event.target.value })} {...props} /></label>
  );

  return (
    <Modal title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"><X aria-hidden="true" size={14} className="mt-0.5 shrink-0" />{error}</div>}
        {field('Supplier / unit name *', 'name', { required: true, autoFocus: true, maxLength: 150 })}
        <div className="grid gap-3 sm:grid-cols-2">{field('Contact person', 'contactName', { maxLength: 150 })}{field('Phone', 'phone', { type: 'tel', maxLength: 20 })}</div>
        <div className="grid gap-3 sm:grid-cols-2">{field('Email', 'email', { type: 'email' })}{field('GSTIN', 'gstin', { maxLength: 15, className: 'input-field uppercase' })}</div>
        <label className="block"><span className="label">Address</span><textarea rows={2} className="input-field resize-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label className="block"><span className="label">What they supply</span><textarea rows={2} className="input-field resize-none" placeholder="e.g. Fabric, stitching job work, printing…" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary min-w-28">{saving ? 'Saving...' : supplier ? 'Save changes' : 'Save supplier'}</button></div>
      </form>
    </Modal>
  );
}
