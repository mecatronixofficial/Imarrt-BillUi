'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, FilePlus2, ImagePlus, Loader2, Paperclip, Plus, Share2, Trash2, X } from 'lucide-react';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Invoice, Item, Party } from '@/types';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';

type LineDraft = { itemId?: string; description: string; quantity: number; unit: string; unitPrice: number; discountPercent: number; taxRate: number };
const emptyLine = (): LineDraft => ({ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, discountPercent: 0, taxRate: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function NewInvoicePage() {
  const router = useRouter();
  const { embedded = false, initialPartyId = '' } = useEmbeddedForm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [partyId, setPartyId] = useState('');
  const [saleMode, setSaleMode] = useState<'CREDIT' | 'CASH'>('CREDIT');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [invoiceNumber, setInvoiceNumber] = useState('Loading...');
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [stateOfSupply, setStateOfSupply] = useState('');
  const [billingName, setBillingName] = useState('');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [roundOff, setRoundOff] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'SAVE' | 'SHARE' | ''>('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getAllPages<Party>('/parties'), getAllPages<Item>('/items')]).then(([partyResponse, itemResponse]) => {
      if (!active) return;
      setParties(partyResponse.data); setCatalog(itemResponse.data);
      const requested = initialPartyId || new URLSearchParams(window.location.search).get('partyId') || '';
      const requestedParty = partyResponse.data.find(({ id }) => id === requested);
      if (requestedParty) {
        setPartyId(requestedParty.id); setBillingName(requestedParty.name); setPhone(requestedParty.phone ?? '');
        setBillingAddress(requestedParty.billingAddr ?? ''); setShippingAddress(requestedParty.shippingAddr || requestedParty.billingAddr || '');
      }
    }).catch((loadError) => setError(getApiError(loadError, 'Could not load customers and items.'))).finally(() => setLoading(false));
    return () => { active = false; };
  }, [initialPartyId]);

  useEffect(() => {
    let active = true;
    void api.get<{ invoiceNumber: string }>('/invoices/next-number')
      .then(({ data }) => { if (active) setInvoiceNumber(data.invoiceNumber); })
      .catch(() => { if (active) setInvoiceNumber('Generated on save'); });
    return () => { active = false; };
  }, []);

  function selectParty(id: string, source = parties) {
    setPartyId(id); const party = source.find((entry) => entry.id === id);
    setBillingName(party?.name ?? ''); setPhone(party?.phone ?? ''); setBillingAddress(party?.billingAddr ?? ''); setShippingAddress(party?.shippingAddr || party?.billingAddr || '');
  }
  function updateLine(index: number, patch: Partial<LineDraft>) { setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function pickItem(index: number, itemId: string) { const item = catalog.find(({ id }) => id === itemId); if (!item) return updateLine(index, { itemId: undefined }); updateLine(index, { itemId, description: item.name, unit: item.unit, unitPrice: Number(item.salePrice), taxRate: Number(item.taxRate) }); }
  const totals = useMemo(() => {
    const quantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const discount = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * line.discountPercent / 100, 0);
    const tax = lines.reduce((sum, line) => { const taxable = line.quantity * line.unitPrice * (1 - line.discountPercent / 100); return sum + taxable * line.taxRate / 100; }, 0);
    const raw = subtotal - discount + tax; const total = roundOff ? Math.round(raw) : raw;
    return { quantity, subtotal, discount, tax, roundAdjustment: total - raw, total };
  }, [lines, roundOff]);

  const selectedParty = parties.find((party) => party.id === partyId);

  async function submit(action: 'SAVE' | 'SHARE') {
    if (saving) return; setError('');
    const validLines = lines.filter((line) => line.description.trim() && line.quantity > 0);
    if (!partyId) return setError('Please select a customer.');
    if (!validLines.length) return setError('Add at least one item.');
    setSaving(action);
    try {
      const { data } = await api.post<{ id: string }>('/invoices', { partyId, issueDate: invoiceDate, dueDate: dueDate || undefined, discount: totals.discount, notes: [terms, notes].filter(Boolean).join('\n\n') || undefined, deliveryMode: 'MANUAL', items: validLines.map((line) => ({ itemId: line.itemId, description: line.description.trim(), quantity: line.quantity, unitPrice: line.unitPrice, taxRate: line.taxRate })) });
      if (saleMode === 'CASH') {
        const { data: savedInvoice } = await api.get<Invoice>(`/invoices/${data.id}`);
        await api.post(`/invoices/${data.id}/payments`, { amount: Number(savedInvoice.grandTotal), method: paymentMethod.toUpperCase().replaceAll(' ', '_') });
      }
      if (action === 'SHARE') await api.post(`/invoices/${data.id}/deliver`, { channels: ['WHATSAPP'] }).catch(() => undefined);
      router.push(`/invoices/${data.id}`);
    } catch (saveError) { setError(getApiError(saveError, 'Could not save the sale invoice.')); setSaving(''); }
  }

  return <div className={`sale-page ${embedded ? 'min-h-[720px]' : '-m-4 h-[calc(100dvh-3.5rem)] sm:-m-5 lg:-m-6 xl:-m-8'} flex max-w-[100vw] flex-col overflow-hidden bg-[#f4f4f4] text-slate-800`}>
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
      <div className="flex flex-wrap items-center gap-4"><h1 className="text-xl font-semibold">Sale</h1><span className="hidden h-7 w-px bg-slate-200 sm:block" /><div className="flex items-center gap-2 text-sm"><button type="button" onClick={() => setSaleMode('CREDIT')} className={saleMode === 'CREDIT' ? 'text-blue-600' : 'text-slate-500'}>Credit</button><button type="button" onClick={() => setSaleMode((value) => value === 'CREDIT' ? 'CASH' : 'CREDIT')} className={`relative h-7 w-14 rounded-full transition ${saleMode === 'CASH' ? 'bg-emerald-200' : 'bg-blue-100'}`}><span className={`absolute top-1 h-5 w-5 rounded-full shadow transition ${saleMode === 'CASH' ? 'left-8 bg-emerald-500' : 'left-1 bg-blue-500'}`} /></button><button type="button" onClick={() => setSaleMode('CASH')} className={saleMode === 'CASH' ? 'text-emerald-600' : 'text-slate-700'}>Cash</button></div></div>
    </header>
    <main className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      {error && <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <section className="grid gap-5 border-b border-slate-200 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-7">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Customer *"><select disabled={loading} value={partyId} onChange={(e) => selectParty(e.target.value)} className="sale-input"><option value="">{loading ? 'Loading...' : 'Select customer'}</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select>{selectedParty && <span className="mt-1 block text-[10px] text-red-500">BAL: {formatCurrency(selectedParty.balanceDue ?? 0)}</span>}</Field>
          <Field label="Billing Name (Optional)"><input className="sale-input" value={billingName} onChange={(e) => setBillingName(e.target.value)} /></Field>
          <Field label="Phone No."><input className="sale-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <textarea rows={4} className="sale-textarea" placeholder="Billing Address" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
          <textarea rows={4} className="sale-textarea" placeholder="Shipping Address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
        </div>
        <div className="space-y-4 rounded-lg bg-white/60 p-4"><div className="flex items-center justify-between border-b border-slate-200 pb-3 text-sm"><span className="text-slate-500">Invoice Number</span><span className="font-mono text-xs text-slate-800">{invoiceNumber}</span></div><Field label="Invoice Date"><div className="relative"><input type="date" className="sale-input pr-10" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /><CalendarDays size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-500" /></div></Field><Field label="Due Date"><input type="date" className="sale-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field><Field label="State of supply"><select className="sale-input" value={stateOfSupply} onChange={(e) => setStateOfSupply(e.target.value)}><option value="">Select state</option><option>Tamil Nadu</option><option>Karnataka</option><option>Kerala</option><option>Andhra Pradesh</option><option>Maharashtra</option><option>Delhi</option><option>Other</option></select></Field></div>
      </section>
      <section className="overflow-x-auto bg-white"><table className="w-full min-w-[1050px] border-collapse text-sm"><thead><tr className="text-left text-xs uppercase text-slate-700"><Th>#</Th><Th>Item</Th><Th>Qty</Th><Th>Unit</Th><Th>Price / Unit</Th><Th>Discount %</Th><Th>Tax %</Th><Th className="text-right">Amount</Th><Th /></tr></thead><tbody>{lines.map((line, index) => { const base = line.quantity * line.unitPrice * (1 - line.discountPercent / 100); const amount = base * (1 + line.taxRate / 100); return <tr key={index} className="bg-slate-50/80"><Td>{index + 1}</Td><Td><select className="sale-cell w-full" value={line.itemId ?? ''} onChange={(e) => pickItem(index, e.target.value)}><option value="">Select / custom item</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input className="sale-cell w-full" placeholder="Description" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} /></Td><Td><input type="number" min="0" className="sale-cell w-20" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} /></Td><Td><input className="sale-cell w-20" value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} /></Td><Td><input type="number" min="0" className="sale-cell w-28" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })} /></Td><Td><input type="number" min="0" max="100" className="sale-cell w-20" value={line.discountPercent} onChange={(e) => updateLine(index, { discountPercent: Number(e.target.value) })} /></Td><Td><input type="number" min="0" max="100" className="sale-cell w-20" value={line.taxRate} onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) })} /></Td><Td className="text-right font-semibold">{formatCurrency(amount)}</Td><Td><button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button></Td></tr>; })}</tbody><tfoot><tr><td /><td className="p-2"><button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="inline-flex items-center gap-1 rounded border border-blue-400 px-3 py-2 text-xs text-blue-600"><Plus size={14} /> Add Row</button></td><td className="border border-slate-200 p-3 font-semibold">{totals.quantity}</td><td colSpan={2} className="border border-slate-200 p-3 text-right font-semibold">Total</td><td className="border border-slate-200 p-3 text-right">{formatCurrency(totals.discount)}</td><td className="border border-slate-200 p-3 text-right">{formatCurrency(totals.tax)}</td><td className="border border-slate-200 p-3 text-right font-semibold">{formatCurrency(totals.total)}</td><td /></tr></tfoot></table></section>
      <section className="grid gap-6 p-6 lg:grid-cols-[1fr_250px_1fr]"><div className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-lg">Terms & Conditions</h2><textarea rows={4} className="sale-textarea mt-4 w-full" placeholder="Enter terms and conditions" value={terms} onChange={(e) => setTerms(e.target.value)} /></div><div className="space-y-3"><button type="button" onClick={() => fileRef.current?.click()} className="attachment-btn"><FilePlus2 size={18} /> Add Document</button><button type="button" onClick={() => fileRef.current?.click()} className="attachment-btn"><ImagePlus size={18} /> Add Image</button><input ref={fileRef} hidden multiple type="file" onChange={(e) => setAttachments(Array.from(e.target.files ?? []))} />{attachments.map((file, i) => <div key={`${file.name}-${i}`} className="flex items-center gap-2 text-xs text-slate-500"><Paperclip size={13} /><span className="truncate">{file.name}</span><button onClick={() => setAttachments((a) => a.filter((_, x) => x !== i))}><X size={13} /></button></div>)}</div><div><label className="flex items-center justify-end gap-3"><input type="checkbox" checked={roundOff} onChange={(e) => setRoundOff(e.target.checked)} className="h-5 w-5 accent-blue-500" /> Round Off <span className="w-24 rounded border bg-white px-3 py-2 text-right">{totals.roundAdjustment.toFixed(2)}</span></label><div className="mt-5 flex items-center justify-end gap-5 text-lg"><span>Total</span><strong className="min-w-52 rounded border bg-white px-4 py-3 text-right">{formatCurrency(totals.total)}</strong></div><textarea className="sale-textarea mt-5 w-full" rows={2} placeholder="Additional description / notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div></section>
    </main>
    <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4"><button type="button" disabled={Boolean(saving)} onClick={() => void submit('SHARE')} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border border-blue-500 px-5 py-3 text-blue-600"><Share2 size={16} />{saving === 'SHARE' ? 'Sharing...' : 'Share'}</button><button type="button" disabled={Boolean(saving)} onClick={() => void submit('SAVE')} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-blue-500 px-7 py-3 text-white shadow-md hover:bg-blue-600">{saving === 'SAVE' && <Loader2 size={16} className="animate-spin" />}{saving === 'SAVE' ? 'Saving...' : 'Save'}</button></footer>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-xs text-slate-500">{label}</span>{children}</label>; }
function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) { return <th className={`border border-slate-200 bg-white px-3 py-3 ${className}`}>{children}</th>; }
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <td className={`border border-slate-200 p-2 ${className}`}>{children}</td>; }
