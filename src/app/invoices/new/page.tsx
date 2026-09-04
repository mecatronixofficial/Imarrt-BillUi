'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Party, Item } from '@/types';

type LineDraft = {
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

const emptyLine = (): LineDraft => ({ description: '', quantity: 1, unitPrice: 0, taxRate: 0 });

export default function NewInvoicePage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [partyId, setPartyId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'PARTY_DEFAULT' | 'MANUAL' | 'AUTOMATIC'>('PARTY_DEFAULT');
  const [deliveryChannels, setDeliveryChannels] = useState<Array<'EMAIL' | 'WHATSAPP'>>(['EMAIL', 'WHATSAPP']);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [partiesResponse, itemsResponse] = await Promise.all([
          getAllPages<Party>('/parties'),
          getAllPages<Item>('/items'),
        ]);
        if (!active) return;
        setParties(partiesResponse.data);
        setCatalog(itemsResponse.data);
        const requestedPartyId = new URLSearchParams(window.location.search).get('partyId');
        if (requestedPartyId && partiesResponse.data.some((party) => party.id === requestedPartyId)) {
          setPartyId(requestedPartyId);
        }
      } catch (loadError: unknown) {
        if (active) setError(getApiError(loadError, 'Could not load parties and items.'));
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function pickCatalogItem(index: number, itemId: string) {
    if (!itemId) {
      updateLine(index, { itemId: undefined });
      return;
    }
    const item = catalog.find(({ id }) => id === itemId);
    if (!item) return;
    updateLine(index, {
      itemId: item.id,
      description: item.name,
      unitPrice: Number(item.salePrice),
      taxRate: Number(item.taxRate),
    });
  }

  const totals = useMemo(() => {
    const subTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (line.taxRate / 100), 0);
    return { subTotal, taxTotal, grandTotal: Math.max(0, subTotal + taxTotal - discount) };
  }, [discount, lines]);
  const selectedParty = parties.find((party) => party.id === partyId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError('');

    if (!partyId) {
      setError('Please select a party.');
      return;
    }
    if (deliveryMode === 'AUTOMATIC' && deliveryChannels.length === 0) {
      setError('Select email, WhatsApp, or both for automatic delivery.');
      return;
    }
    if (lines.some((line) => !line.description.trim() || line.quantity <= 0 || line.unitPrice < 0)) {
      setError('Please complete every line item with valid values.');
      return;
    }
    if (discount > totals.subTotal + totals.taxTotal) {
      setError('Discount cannot be greater than the invoice total.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post<{ id: string }>('/invoices', {
        partyId,
        dueDate: dueDate || undefined,
        discount,
        notes: notes.trim() || undefined,
        deliveryMode: deliveryMode === 'PARTY_DEFAULT' ? undefined : deliveryMode,
        deliveryChannels: deliveryMode === 'AUTOMATIC' ? deliveryChannels : undefined,
        items: lines.map((line) => ({ ...line, description: line.description.trim() })),
      });
      router.push(`/invoices/${data.id}`);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, 'Could not create invoice.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="New invoice"
        description="Create a professional invoice for your party."
        action={
          <Link href="/invoices" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft aria-hidden="true" size={15} /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
          <div>
            <label htmlFor="invoice-party" className="label">Party *</label>
            <select id="invoice-party" required disabled={loadingOptions} className="input-field" value={partyId} onChange={(event) => setPartyId(event.target.value)}>
              <option value="">{loadingOptions ? 'Loading parties...' : 'Select party'}</option>
              {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
            </select>
            {!loadingOptions && parties.length === 0 && <p className="mt-1.5 text-xs text-amber-600">Add a party before creating an invoice.</p>}
          </div>
          <div>
            <label htmlFor="invoice-due-date" className="label">Due date</label>
            <input id="invoice-due-date" type="date" className="input-field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="invoice-discount" className="label">Discount</label>
            <input id="invoice-discount" type="number" min="0" step="0.01" className="input-field" value={discount} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value)))} />
          </div>
        </section>

        <section className="card p-4">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Send size={17} /></span><div><h2 className="text-sm font-bold text-slate-900">Invoice delivery</h2><p className="mt-0.5 text-xs text-slate-500">Send automatically after generation or keep manual control.</p></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => setDeliveryMode('PARTY_DEFAULT')} className={`rounded-xl border p-3 text-left transition ${deliveryMode === 'PARTY_DEFAULT' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:bg-slate-50'}`}><p className="text-xs font-bold text-slate-800">Party default</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{selectedParty ? `${selectedParty.invoiceDeliveryMode === 'AUTOMATIC' ? 'Auto' : 'Manual'} · ${(selectedParty.invoiceDeliveryChannel || 'BOTH').toLowerCase()}` : 'Select a party'}</p></button>
            <button type="button" onClick={() => setDeliveryMode('MANUAL')} className={`rounded-xl border p-3 text-left transition ${deliveryMode === 'MANUAL' ? 'border-slate-400 bg-slate-50 ring-2 ring-slate-100' : 'border-slate-200 hover:bg-slate-50'}`}><p className="text-xs font-bold text-slate-800">Manual send</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Create first, then choose WhatsApp, email, share, or PDF.</p></button>
            <button type="button" onClick={() => setDeliveryMode('AUTOMATIC')} className={`rounded-xl border p-3 text-left transition ${deliveryMode === 'AUTOMATIC' ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:bg-slate-50'}`}><p className="text-xs font-bold text-slate-800">Send automatically</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Generate the PDF and deliver immediately.</p></button>
          </div>
          {deliveryMode === 'AUTOMATIC' && <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3"><button type="button" onClick={() => setDeliveryChannels((current) => current.includes('EMAIL') ? current.filter((channel) => channel !== 'EMAIL') : [...current, 'EMAIL'])} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${deliveryChannels.includes('EMAIL') ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400'}`}><Mail size={14} /> Email {selectedParty?.email ? `· ${selectedParty.email}` : '· missing'}</button><button type="button" onClick={() => setDeliveryChannels((current) => current.includes('WHATSAPP') ? current.filter((channel) => channel !== 'WHATSAPP') : [...current, 'WHATSAPP'])} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${deliveryChannels.includes('WHATSAPP') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}><MessageCircle size={14} /> WhatsApp · {selectedParty?.whatsappNumber || selectedParty?.phone || 'missing'}</button></div>}
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Line items</h2>
              <p className="mt-0.5 text-xs text-slate-500">Add products, services, quantity, and tax.</p>
            </div>
            <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
              <Plus aria-hidden="true" size={14} /> Add line
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="col-span-12 sm:col-span-4">
                  <label htmlFor={`line-item-${index}`} className="label">Item / description</label>
                  <select id={`line-item-${index}`} className="input-field mb-2" value={line.itemId ?? ''} onChange={(event) => pickCatalogItem(index, event.target.value)}>
                    <option value="">Custom item</option>
                    {catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <input aria-label={`Description for line ${index + 1}`} required className="input-field" placeholder="Description" value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label htmlFor={`line-qty-${index}`} className="label">Quantity</label>
                  <input id={`line-qty-${index}`} required type="number" min="0.01" step="0.01" className="input-field" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label htmlFor={`line-price-${index}`} className="label">Unit price</label>
                  <input id={`line-price-${index}`} required type="number" min="0" step="0.01" className="input-field" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) })} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label htmlFor={`line-tax-${index}`} className="label">Tax %</label>
                  <input id={`line-tax-${index}`} type="number" min="0" max="100" step="0.01" className="input-field" value={line.taxRate} onChange={(event) => updateLine(index, { taxRate: Number(event.target.value) })} />
                </div>
                <div className="col-span-10 text-right text-sm font-bold text-slate-800 sm:col-span-1 sm:pb-2">
                  {formatCurrency(line.quantity * line.unitPrice * (1 + line.taxRate / 100))}
                </div>
                <div className="col-span-2 flex justify-end sm:col-span-1 sm:pb-1">
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Remove line ${index + 1}`}>
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="card p-4">
            <label htmlFor="invoice-notes" className="label">Notes</label>
            <textarea id="invoice-notes" className="input-field resize-none" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Payment terms or a thank-you note" />
          </section>
          <section className="card p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(totals.subTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{formatCurrency(totals.taxTotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatCurrency(discount)}</span></div>
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-lg font-bold text-slate-950"><span>Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
            </div>
          </section>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving || loadingOptions || parties.length === 0} className="btn-primary inline-flex min-w-36 items-center justify-center gap-2">
            {saving && <Loader2 aria-hidden="true" size={16} className="animate-spin" />}
            {saving ? 'Creating...' : 'Create invoice'}
          </button>
        </div>
      </form>
    </>
  );
}
