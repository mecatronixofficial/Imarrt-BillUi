'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, FileText, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { api, getAllPages, getApiError } from '@/lib/api';
import { DOCUMENT_CONFIG, DOCUMENT_TYPES, isDocumentType } from '@/lib/documents';
import { formatCurrency } from '@/lib/format';
import type { BusinessDocument, BusinessDocumentType, Party, Invoice, Item, Supplier } from '@/types';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';

type LineDraft = {
  itemId?: string;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
};

const emptyLine = (): LineDraft => ({ description: '', hsnSac: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function NewDocumentPage() {
  const { embedded = false, initialType, initialPartyId } = useEmbeddedForm();
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}><DocumentComposer embedded={embedded} initialType={initialType} initialPartyId={initialPartyId} /></Suspense>;
}

function DocumentComposer({ embedded, initialType, initialPartyId }: { embedded: boolean; initialType?: BusinessDocumentType; initialPartyId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedType = searchParams.get('type');
  const requestedPartyId = initialPartyId || searchParams.get('partyId');
  const [type, setType] = useState<BusinessDocumentType>(initialType ?? (isDocumentType(requestedType) ? requestedType : 'QUOTATION'));
  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [partyId, setPartyId] = useState('');
  const [referenceInvoiceId, setReferenceInvoiceId] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [validUntil, setValidUntil] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [transportName, setTransportName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [eWayBillNumber, setEWayBillNumber] = useState('');
  const [reason, setReason] = useState('');
  const [terms, setTerms] = useState('Prices and taxes are subject to the terms agreed with the party.');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'DRAFT' | 'ISSUED' | ''>('');
  const [error, setError] = useState('');
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [sourceParty, setSourceParty] = useState<Party | null>(null);

  const isPurchase = type === 'PURCHASE_INVOICE';
  const isAdjustment = type === 'CREDIT_NOTE' || type === 'DEBIT_NOTE';
  const isChallan = type === 'DELIVERY_CHALLAN';
  const config = DOCUMENT_CONFIG[type];
  const availableParties = isPurchase ? suppliers : parties;

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getAllPages<Party>('/parties'),
      getAllPages<Supplier>('/suppliers'),
      getAllPages<Item>('/items'),
      getAllPages<Invoice>('/invoices'),
    ]).then(([partyResponse, supplierResponse, itemResponse, invoiceResponse]) => {
      if (!active) return;
      setParties(partyResponse.data);
      setSuppliers(supplierResponse.data);
      setCatalog(itemResponse.data);
      setInvoices(invoiceResponse.data);
      if (requestedPartyId) {
        const requestedParty = partyResponse.data.find((party) => party.id === requestedPartyId) ?? null;
        setSourceParty(requestedParty);
        if (isPurchase && requestedParty) {
          const normalizedPhone = requestedParty.phone?.replace(/\D/g, '');
          const matchingSupplier = supplierResponse.data.find((supplier) =>
            supplier.name.trim().toLowerCase() === requestedParty.name.trim().toLowerCase()
            || Boolean(requestedParty.email && supplier.email?.trim().toLowerCase() === requestedParty.email.trim().toLowerCase())
            || Boolean(normalizedPhone && supplier.phone?.replace(/\D/g, '') === normalizedPhone),
          );
          if (matchingSupplier) setPartyId(matchingSupplier.id);
        } else if (!isPurchase && requestedParty) {
          setPartyId(requestedParty.id);
        }
      }
    }).catch((loadError: unknown) => {
      if (active) setError(getApiError(loadError, 'Could not load document options.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isPurchase, requestedPartyId]);

  useEffect(() => {
    setPartyId('');
    setReferenceInvoiceId('');
    setReason('');
  }, [type]);

  const totals = useMemo(() => {
    const subTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * line.taxRate / 100, 0);
    return { subTotal, taxTotal, grandTotal: Math.max(0, subTotal + taxTotal - discount) };
  }, [discount, lines]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function pickItem(index: number, itemId: string) {
    const item = catalog.find((entry) => entry.id === itemId);
    if (!item) { updateLine(index, { itemId: undefined }); return; }
    updateLine(index, { itemId: item.id, description: item.name, unit: item.unit, unitPrice: Number(item.salePrice), taxRate: Number(item.taxRate) });
  }

  async function pickReferenceInvoice(invoiceId: string) {
    setReferenceInvoiceId(invoiceId);
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (invoice?.party?.id) setPartyId(invoice.party.id);
    if (!invoiceId) return;
    try {
      const { data } = await api.get<Invoice>(`/invoices/${invoiceId}`);
      if (data.items?.length) {
        setLines(data.items.map((item) => ({
          description: item.description,
          hsnSac: '',
          quantity: Number(item.quantity),
          unit: 'pcs',
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
        })));
      }
    } catch {
      // The reference remains valid even if line prefill is unavailable.
    }
  }

  async function submit(status: 'DRAFT' | 'ISSUED') {
    if (saving) return;
    setError('');
    if (!partyId) { setError(`Select a ${isPurchase ? 'supplier' : 'party'}.`); return; }
    if (isAdjustment && !referenceInvoiceId) { setError('Select the invoice this note adjusts.'); return; }
    if (lines.some((line) => !line.description.trim() || line.quantity <= 0 || line.unitPrice < 0 || line.taxRate < 0 || line.taxRate > 100)) {
      setError('Complete every line with valid description, quantity, price, and tax values.'); return;
    }
    if (discount > totals.subTotal + totals.taxTotal) { setError('Discount cannot exceed the document value.'); return; }

    setSaving(status);
    try {
      const payload = {
        type,
        status,
        partyId: isPurchase ? undefined : partyId,
        supplierId: isPurchase ? partyId : undefined,
        referenceInvoiceId: isAdjustment ? referenceInvoiceId : undefined,
        issueDate,
        validUntil: validUntil || undefined,
        dueDate: dueDate || undefined,
        discount,
        referenceNumber: referenceNumber.trim() || undefined,
        placeOfSupply: placeOfSupply.trim() || undefined,
        transportName: isChallan ? transportName.trim() || undefined : undefined,
        vehicleNumber: isChallan ? vehicleNumber.trim() || undefined : undefined,
        eWayBillNumber: isChallan ? eWayBillNumber.trim() || undefined : undefined,
        reason: isAdjustment ? reason.trim() || undefined : undefined,
        terms: terms.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((line) => ({ ...line, description: line.description.trim(), hsnSac: line.hsnSac.trim() || undefined })),
      };
      const { data } = await api.post<BusinessDocument>('/documents', payload);
      router.push(`/documents/${data.id}`);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, `Could not create ${config.label.toLowerCase()}.`));
    } finally {
      setSaving('');
    }
  }

  return (
    <>
      {!embedded && <PageHeader title={`New ${config.label.toLowerCase()}`} description={config.description} action={<Link href="/documents" className="btn-secondary inline-flex items-center gap-2"><ArrowLeft size={15} /> Documents</Link>} />}

      {!embedded && <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {DOCUMENT_TYPES.map((documentType) => {
          const item = DOCUMENT_CONFIG[documentType];
          return <button type="button" key={documentType} onClick={() => setType(documentType)} className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${type === documentType ? `${item.soft} ${item.accent} ${item.border} ring-2 ring-slate-100` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{item.label}</button>;
        })}
      </div>}

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="card p-5">
            <div className="mb-4 flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${config.soft} ${config.accent}`}><Building2 size={17} /></span><div><h2 className="text-sm font-bold text-slate-900">Document details</h2><p className="text-xs text-slate-500">Party, dates, reference, and document context</p></div></div>
            {isPurchase && sourceParty && <div className="mb-4 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-blue-900">Expense contact: {sourceParty.name}</p><p className="mt-0.5 text-[10px] text-blue-700">{[sourceParty.phone, sourceParty.email, sourceParty.billingAddr].filter(Boolean).join(' · ') || 'No contact details saved'}</p></div>{!partyId && <button type="button" onClick={() => setShowSupplierForm(true)} className="btn-secondary shrink-0 px-3 py-1.5 text-xs"><Plus size={13} className="mr-1 inline" /> Add as supplier</button>}</div>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2"><label htmlFor="document-party" className="label">{isPurchase ? 'Supplier' : 'Party'} *</label><div className="flex gap-2"><select id="document-party" required disabled={loading || isAdjustment} className="input-field" value={partyId} onChange={(event) => setPartyId(event.target.value)}><option value="">{loading ? 'Loading...' : `Select ${isPurchase ? 'supplier' : 'party'}`}</option>{availableParties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select>{isPurchase && <button type="button" onClick={() => setShowSupplierForm(true)} className="btn-secondary shrink-0 px-3" title="Add supplier"><Plus size={16} /></button>}</div>{!isPurchase && parties.length === 0 && <Link href="/parties" className="mt-1.5 inline-block text-xs font-semibold text-blue-600">Add a party first</Link>}</div>
              <div><label htmlFor="document-date" className="label">Issue date *</label><input id="document-date" required type="date" className="input-field" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></div>
              {isAdjustment && <div className="md:col-span-2"><label htmlFor="document-invoice" className="label">Against invoice *</label><select id="document-invoice" className="input-field" value={referenceInvoiceId} onChange={(event) => void pickReferenceInvoice(event.target.value)}><option value="">Select invoice</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.party?.name} · {formatCurrency(invoice.grandTotal)}</option>)}</select></div>}
              {(type === 'QUOTATION' || type === 'PROFORMA_INVOICE') && <div><label htmlFor="valid-until" className="label">Valid until</label><input id="valid-until" type="date" className="input-field" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></div>}
              {(type === 'PROFORMA_INVOICE' || isPurchase) && <div><label htmlFor="due-date" className="label">Due date</label><input id="due-date" type="date" className="input-field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>}
              <div><label htmlFor="reference-number" className="label">Party reference / PO number</label><input id="reference-number" className="input-field" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Optional reference" /></div>
              <div><label htmlFor="place-supply" className="label">Place of supply</label><input id="place-supply" className="input-field" value={placeOfSupply} onChange={(event) => setPlaceOfSupply(event.target.value)} placeholder="State or location" /></div>
            </div>
            {isChallan && <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-3"><div><label className="label">Transport / courier</label><input className="input-field" value={transportName} onChange={(event) => setTransportName(event.target.value)} /></div><div><label className="label">Vehicle number</label><input className="input-field uppercase" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())} /></div><div><label className="label">E-way bill number</label><input className="input-field" value={eWayBillNumber} onChange={(event) => setEWayBillNumber(event.target.value)} /></div></div>}
            {isAdjustment && <div className="mt-4"><label htmlFor="adjustment-reason" className="label">Reason for adjustment *</label><textarea id="adjustment-reason" required rows={2} className="input-field resize-none" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Return, rate difference, additional charge, or correction..." /></div>}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold text-slate-900">Items and taxation</h2><p className="mt-0.5 text-xs text-slate-500">Catalog or custom items with HSN/SAC, unit, rate, and GST</p></div><button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={14} /> Add line</button></div>
            <div className="space-y-3 p-4">
              {lines.map((line, index) => (
                <div key={index} className="relative rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Line {index + 1}</span><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={15} /></button></div>
                  <div className="grid grid-cols-12 gap-2.5">
                    <div className="col-span-12 md:col-span-4"><label className="label">Catalog item</label><select className="input-field" value={line.itemId ?? ''} onChange={(event) => pickItem(index, event.target.value)}><option value="">Custom item / service</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                    <div className="col-span-12 md:col-span-5"><label className="label">Description *</label><input required className="input-field" value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></div>
                    <div className="col-span-6 md:col-span-3"><label className="label">HSN / SAC</label><input className="input-field" value={line.hsnSac} onChange={(event) => updateLine(index, { hsnSac: event.target.value })} /></div>
                    <div className="col-span-6 md:col-span-2"><label className="label">Quantity *</label><input required type="number" min="0.001" step="0.001" className="input-field" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></div>
                    <div className="col-span-6 md:col-span-2"><label className="label">Unit</label><input className="input-field" value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value })} /></div>
                    <div className="col-span-6 md:col-span-3"><label className="label">Rate *</label><input required type="number" min="0" step="0.01" className="input-field" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} /></div>
                    <div className="col-span-6 md:col-span-2"><label className="label">GST %</label><input type="number" min="0" max="100" step="0.01" className="input-field" value={line.taxRate} onChange={(event) => updateLine(index, { taxRate: Number(event.target.value) })} /></div>
                    <div className="col-span-6 flex items-end justify-end md:col-span-3"><div className="pb-2 text-right"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Line total</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatCurrency(line.quantity * line.unitPrice * (1 + line.taxRate / 100))}</p></div></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card grid gap-4 p-5 md:grid-cols-2"><div><label htmlFor="document-terms" className="label">Terms and conditions</label><textarea id="document-terms" rows={4} className="input-field resize-none" value={terms} onChange={(event) => setTerms(event.target.value)} /></div><div><label htmlFor="document-notes" className="label">Internal / party notes</label><textarea id="document-notes" rows={4} className="input-field resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Payment instructions, delivery notes, or a thank-you message" /></div></section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="card overflow-hidden"><div className={`border-b p-5 ${config.soft} ${config.border}`}><p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${config.accent}`}>Live summary</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{config.label}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Number assigned automatically when saved</p></div><div className="space-y-3 p-5 text-sm"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subTotal)}</span></div><div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{formatCurrency(totals.taxTotal)}</span></div><div className="flex items-center justify-between gap-4"><label htmlFor="document-discount" className="text-slate-500">Discount</label><input id="document-discount" type="number" min="0" step="0.01" className="input-field min-h-8 w-28 py-1 text-right" value={discount} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value)))} /></div><div className="flex justify-between border-t border-slate-100 pt-4 text-lg font-extrabold text-slate-950"><span>Total</span><span>{formatCurrency(totals.grandTotal)}</span></div></div></section>
          <section className="card space-y-2 p-4"><button type="button" disabled={Boolean(saving) || loading} onClick={() => void submit('ISSUED')} className="btn-primary flex w-full items-center justify-center gap-2">{saving === 'ISSUED' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Save and issue</button><button type="button" disabled={Boolean(saving) || loading} onClick={() => void submit('DRAFT')} className="btn-secondary flex w-full items-center justify-center gap-2">{saving === 'DRAFT' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save as draft</button><p className="px-1 pt-1 text-center text-[10px] leading-4 text-slate-400">Issued purchase invoices automatically add catalog quantities to stock.</p></section>
        </aside>
      </div>

      {showSupplierForm && <SupplierQuickAdd initialParty={sourceParty} onClose={() => setShowSupplierForm(false)} onSaved={(supplier) => { setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name))); setPartyId(supplier.id); setShowSupplierForm(false); }} />}
    </>
  );
}

function SupplierQuickAdd({ initialParty, onClose, onSaved }: { initialParty?: Party | null; onClose: () => void; onSaved: (supplier: Supplier) => void }) {
  const [form, setForm] = useState({ name: initialParty?.name ?? '', contactName: '', phone: initialParty?.phone ?? '', email: initialParty?.email ?? '', gstin: initialParty?.gstin ?? '', address: initialParty?.billingAddr ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || undefined]));
      const { data } = await api.post<Supplier>('/suppliers', payload); onSaved(data);
    } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not add supplier.')); }
    finally { setSaving(false); }
  }
  return <Modal title="Add supplier" onClose={onClose}><form onSubmit={submit} className="space-y-3">{error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}<div><label className="label">Supplier name *</label><input required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Contact person</label><input className="input-field" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></div><div><label className="label">GSTIN</label><input maxLength={15} className="input-field uppercase" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} /></div><div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div><div><label className="label">Email</label><input type="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div></div><div><label className="label">Address</label><textarea rows={2} className="input-field resize-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div><div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add supplier'}</button></div></form></Modal>;
}
