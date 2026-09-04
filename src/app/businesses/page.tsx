'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, FileCheck2, MapPin, Plus, ReceiptText } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import {
  api,
  getAllPages,
  getActiveBranchId,
  getActiveBusinessId,
  getApiError,
  getCurrentUser,
  setActiveBranchId,
  setActiveBusinessId,
} from '@/lib/api';
import type { Branch, Business } from '@/types';

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeId, setActiveId] = useState('');
  const [activeBranchId, setSelectedBranchId] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data }, user] = await Promise.all([getAllPages<Business>('/businesses'), getCurrentUser()]);
      setBusinesses(data);
      setCanCreate(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN');
      const stored = getActiveBusinessId();
      const selected = data.some(({ id }) => id === stored) ? stored! : data[0]?.id ?? '';
      if (selected) setActiveBusinessId(selected);
      setActiveId(selected);
      if (selected) {
        const { data: companyBranches } = await getAllPages<Branch>('/branches');
        setBranches(companyBranches);
        const storedBranch = getActiveBranchId(selected);
        const selectedBranch = storedBranch === 'all' || companyBranches.some(({ id, isActive }) => id === storedBranch && isActive)
          ? storedBranch!
          : companyBranches.find(({ isActive }) => isActive)?.id ?? '';
        if (selectedBranch) setActiveBranchId(selectedBranch, selected);
        setSelectedBranchId(selectedBranch);
      }
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load businesses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  function selectBusiness(businessId: string) {
    setActiveBusinessId(businessId);
    window.location.href = '/dashboard';
  }

  function selectBranch(branchId: string) {
    setActiveBranchId(branchId, activeId);
    setSelectedBranchId(branchId);
    window.location.href = '/dashboard';
  }

  return (
    <>
      <PageHeader
        title="Company & branches"
        description="Parties and items are shared company-wide. Transactions, production, and reports follow the selected branch."
        action={canCreate ? (
          <button type="button" onClick={() => businesses.length ? setShowBranchForm(true) : setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus aria-hidden="true" size={16} /> {businesses.length ? 'Add branch' : 'Add company'}
          </button>
        ) : undefined}
      />

      {loading ? (
        <div className="card"><LoadingState label="Loading businesses..." /></div>
      ) : error ? (
        <div className="card"><ErrorState message={error} onRetry={loadBusinesses} /></div>
      ) : businesses.length === 0 ? (
        <div className="card">
          <EmptyState icon={Building2} title="No company added" description="Add your company to start billing. A Main Branch will be created automatically." />
          {canCreate && (
            <div className="flex justify-center pb-6">
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus aria-hidden="true" size={16} /> Add your company
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => {
            const active = business.id === activeId;
            return (
              <button
                type="button"
                key={business.id}
                onClick={() => selectBusiness(business.id)}
                className={`card group relative p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md ${active ? 'border-blue-300 ring-2 ring-blue-100' : ''}`}
              >
                {active && (
                  <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check aria-hidden="true" size={14} strokeWidth={3} />
                  </span>
                )}
                <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${business.gstRegistered ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                  {business.gstRegistered ? <FileCheck2 aria-hidden="true" size={21} /> : <ReceiptText aria-hidden="true" size={21} />}
                </span>
                <h2 className="pr-8 text-base font-bold text-slate-900">{business.name}</h2>
                {business.legalName && business.legalName !== business.name && <p className="mt-1 truncate text-xs text-slate-500">{business.legalName}</p>}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${business.gstRegistered ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                    {business.gstRegistered ? `GST · ${business.gstin ?? ''}` : 'Non-GST business'}
                  </span>
                  {business._count && <span className="text-[11px] text-slate-400">{business._count.invoices} invoices</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && businesses.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><h2 className="text-base font-bold text-slate-900">Branches</h2><p className="mt-0.5 text-xs text-slate-500">Choose where operational records should be created and reported.</p></div>
            <button type="button" onClick={() => selectBranch('all')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeBranchId === 'all' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>All branches view</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => {
              const active = branch.id === activeBranchId;
              return (
                <button key={branch.id} type="button" disabled={!branch.isActive} onClick={() => selectBranch(branch.id)} className={`card flex items-start gap-3 p-4 text-left transition hover:border-blue-200 ${active ? 'border-blue-300 ring-2 ring-blue-100' : ''} disabled:cursor-not-allowed disabled:opacity-60`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}><MapPin aria-hidden="true" size={18} /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold text-slate-900">{branch.name}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{branch.code}</span></span><span className="mt-1 block truncate text-xs text-slate-500">{branch.address || 'No branch address'}</span>{branch._count && <span className="mt-2 block text-[10px] text-slate-400">{branch._count.invoices} invoices · {branch._count.documents} documents · {branch._count.productionOrders} production orders</span>}</span>
                  {active && <Check aria-hidden="true" size={16} className="shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showForm && (
        <BusinessFormModal
          onClose={() => setShowForm(false)}
          onSaved={(business) => {
            setActiveBusinessId(business.id);
            setShowForm(false);
            window.location.href = '/dashboard';
          }}
        />
      )}
      {showBranchForm && (
        <BranchFormModal
          onClose={() => setShowBranchForm(false)}
          onSaved={(branch) => {
            setBranches((current) => [...current, branch]);
            setActiveBranchId(branch.id, activeId);
            setSelectedBranchId(branch.id);
            setShowBranchForm(false);
          }}
        />
      )}
    </>
  );
}

function BusinessFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (business: Business) => void }) {
  const [form, setForm] = useState({
    name: '', legalName: '', gstRegistered: true, gstin: '', address: '', stateCode: '', phone: '', email: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<Business>('/businesses', {
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        gstRegistered: form.gstRegistered,
        gstin: form.gstRegistered ? form.gstin.trim().toUpperCase() : undefined,
        address: form.address.trim() || undefined,
        stateCode: form.stateCode.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim().toLowerCase() || undefined,
      });
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, 'Could not create business.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add company" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setForm({ ...form, gstRegistered: true })} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${form.gstRegistered ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            GST registered
          </button>
          <button type="button" onClick={() => setForm({ ...form, gstRegistered: false, gstin: '' })} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${!form.gstRegistered ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>
            Without GST
          </button>
        </div>

        <div>
          <label htmlFor="business-name" className="label">Business name *</label>
          <input id="business-name" required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Sunrise Traders" />
        </div>
        <div>
          <label htmlFor="business-legal-name" className="label">Legal name</label>
          <input id="business-legal-name" className="input-field" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
        </div>

        {form.gstRegistered && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px]">
            <div>
              <label htmlFor="business-gstin" className="label">GSTIN *</label>
              <input id="business-gstin" required minLength={15} maxLength={15} className="input-field uppercase" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value })} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <label htmlFor="business-state" className="label">State code</label>
              <input id="business-state" inputMode="numeric" minLength={2} maxLength={2} className="input-field" value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value.replace(/\D/g, '') })} placeholder="22" />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="business-address" className="label">Business address</label>
          <textarea id="business-address" rows={2} className="input-field resize-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="business-phone" className="label">Phone</label>
            <input id="business-phone" type="tel" className="input-field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </div>
          <div>
            <label htmlFor="business-email" className="label">Email</label>
            <input id="business-email" type="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
        </div>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
          {form.gstRegistered ? 'GST invoices will include tax rates and your GSTIN.' : 'Tax will be fixed at 0% for this business and invoices will be marked non-GST.'}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary min-w-32">{saving ? 'Creating...' : 'Create company'}</button>
        </div>
      </form>
    </Modal>
  );
}

function BranchFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (branch: Branch) => void }) {
  const [form, setForm] = useState({ name: '', code: '', address: '', stateCode: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<Branch>('/branches', {
        name: form.name.trim(), code: form.code.trim().toUpperCase(), address: form.address.trim() || undefined,
        stateCode: form.stateCode || undefined, phone: form.phone.trim() || undefined, email: form.email.trim().toLowerCase() || undefined,
      });
      onSaved(data);
    } catch (saveError) {
      setError(getApiError(saveError, 'Could not create branch.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add branch" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div><label htmlFor="branch-name" className="label">Branch name *</label><input id="branch-name" required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Mumbai Branch" /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="branch-code" className="label">Branch code *</label><input id="branch-code" required minLength={2} maxLength={24} pattern="[A-Za-z0-9_-]{2,24}" className="input-field uppercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} placeholder="MUM" /></div><div><label htmlFor="branch-state" className="label">State code</label><input id="branch-state" inputMode="numeric" maxLength={2} className="input-field" value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value.replace(/\D/g, '') })} placeholder="27" /></div></div>
        <div><label htmlFor="branch-address" className="label">Address</label><textarea id="branch-address" rows={2} className="input-field resize-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="branch-phone" className="label">Phone</label><input id="branch-phone" type="tel" className="input-field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div><div><label htmlFor="branch-email" className="label">Email</label><input id="branch-email" type="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div></div>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">Parties, suppliers, and items stay shared with every branch. New transactions will use this branch.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary min-w-28">{saving ? 'Creating...' : 'Create branch'}</button></div>
      </form>
    </Modal>
  );
}
