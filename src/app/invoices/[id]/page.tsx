'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, Download, IndianRupee, Loader2, Mail, MessageCircle, ReceiptText, Send, Share2, XCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { api, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice, InvoiceDelivery, InvoiceDeliveryChannel } from '@/types';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<InvoiceDeliveryChannel | ''>('');
  const [error, setError] = useState('');

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Invoice>(`/invoices/${id}`);
      setInvoice(data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load this invoice.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  async function downloadPdf() {
    if (!invoice || downloading) return;
    setDownloading(true);
    setError('');
    try {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError: unknown) {
      setError(getApiError(downloadError, 'Could not download the invoice PDF.'));
    } finally {
      setDownloading(false);
    }
  }

  function invoiceSummary() {
    if (!invoice) return '';
    const balance = Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid));
    return `Invoice ${invoice.invoiceNumber}\n${invoice.party.name}\nTotal: ${formatCurrency(invoice.grandTotal)}\nBalance due: ${formatCurrency(balance)}\nIssued: ${formatDate(invoice.issueDate)}`;
  }

  function shareWhatsApp() {
    if (!invoice) return;
    const rawNumber = (invoice.party.whatsappNumber || invoice.party.phone || '').replace(/\D/g, '');
    const number = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(invoiceSummary())}`, '_blank', 'noopener,noreferrer');
  }

  function shareEmail() {
    if (!invoice) return;
    const subject = `Invoice ${invoice.invoiceNumber}`;
    window.location.href = `mailto:${encodeURIComponent(invoice.party.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${invoiceSummary()}\n\nPlease find the invoice details above. You can attach the downloaded PDF to this email.`)}`;
  }

  async function nativeShare() {
    if (!invoice || sharing) return;
    setSharing(true); setError('');
    try {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const file = new File([response.data], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' });
      const data: ShareData = { title: `Invoice ${invoice.invoiceNumber}`, text: invoiceSummary(), files: [file] };
      if (navigator.share && navigator.canShare?.(data)) await navigator.share(data);
      else if (navigator.share) await navigator.share({ title: data.title, text: data.text });
      else setError('Native sharing is unavailable in this browser. Use WhatsApp, email, or download the PDF.');
    } catch (shareError: unknown) {
      if (!(shareError instanceof DOMException && shareError.name === 'AbortError')) setError('Could not share the invoice. Try downloading the PDF instead.');
    } finally { setSharing(false); }
  }

  async function sendThroughProvider(channel: InvoiceDeliveryChannel) {
    if (!invoice || sendingChannel) return;
    setSendingChannel(channel); setError('');
    try {
      const { data } = await api.post<InvoiceDelivery[]>(`/invoices/${invoice.id}/deliver`, { channels: [channel] });
      const failed = data.find((attempt) => attempt.status === 'FAILED');
      await loadInvoice();
      if (failed) setError(failed.errorMessage || `${channel === 'EMAIL' ? 'Email' : 'WhatsApp'} delivery failed.`);
    } catch (sendError: unknown) { setError(getApiError(sendError, 'Could not send the invoice.')); }
    finally { setSendingChannel(''); }
  }

  if (loading) {
    return <><div className="card"><LoadingState label="Loading invoice..." /></div></>;
  }

  if (error && !invoice) {
    return <><div className="card"><ErrorState message={error} onRetry={loadInvoice} /></div></>;
  }

  if (!invoice) {
    return <><div className="card"><ErrorState message="Invoice not found." /></div></>;
  }

  const balanceDue = Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid));

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        description={`Issued ${formatDate(invoice.issueDate)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/invoices" className="btn-secondary inline-flex items-center gap-2">
              <ArrowLeft aria-hidden="true" size={15} /> Back
            </Link>
            {balanceDue > 0 && invoice.status !== 'CANCELLED' && (
              <button type="button" onClick={() => setShowPayment(true)} className="btn-secondary inline-flex items-center gap-2">
                <IndianRupee aria-hidden="true" size={15} /> Record payment
              </button>
            )}
            <button type="button" onClick={shareWhatsApp} className="btn-secondary inline-flex items-center gap-2 text-emerald-700">
              <MessageCircle aria-hidden="true" size={15} /> WhatsApp
            </button>
            <button type="button" onClick={shareEmail} className="btn-secondary inline-flex items-center gap-2 text-blue-700">
              <Mail aria-hidden="true" size={15} /> Email
            </button>
            <button type="button" onClick={() => void nativeShare()} disabled={sharing} className="btn-secondary inline-flex items-center gap-2 text-indigo-700">
              {sharing ? <Loader2 aria-hidden="true" size={15} className="animate-spin" /> : <Share2 aria-hidden="true" size={15} />} Share
            </button>
            <button type="button" onClick={() => void downloadPdf()} disabled={downloading} className="btn-primary inline-flex items-center gap-2">
              {downloading ? <Loader2 aria-hidden="true" size={15} className="animate-spin" /> : <Download aria-hidden="true" size={15} />}
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
        }
      />

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <article className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ReceiptText aria-hidden="true" size={19} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
              <p className="mt-1 font-bold text-slate-900">{invoice.party.name}</p>
              {invoice.party.billingAddr && <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{invoice.party.billingAddr}</p>}
              {invoice.party.phone && <p className="text-xs text-slate-500">{invoice.party.phone}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <StatusBadge status={invoice.status} />
            {invoice.dueDate && <p className="mt-2 text-xs text-slate-500">Due {formatDate(invoice.dueDate)}</p>}
          </div>
        </div>

        <div className="overflow-x-auto px-5 pt-2">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
              <tr>
                <th className="py-3 font-semibold">Description</th>
                <th className="py-3 text-right font-semibold">Qty</th>
                <th className="py-3 text-right font-semibold">Unit price</th>
                <th className="py-3 text-right font-semibold">Tax</th>
                <th className="py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 font-medium text-slate-800">{item.description}</td>
                  <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                  <td className="whitespace-nowrap py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-right text-slate-600">{Number(item.taxRate).toFixed(2)}%</td>
                  <td className="whitespace-nowrap py-3 text-right font-semibold text-slate-800">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end p-5 pt-4">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(invoice.subTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{formatCurrency(invoice.taxTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatCurrency(invoice.discount)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold"><span>Total</span><span>{formatCurrency(invoice.grandTotal)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(invoice.amountPaid)}</span></div>
            <div className="flex justify-between rounded-lg bg-red-50 px-3 py-2 font-bold text-red-600"><span>Balance due</span><span>{formatCurrency(balanceDue)}</span></div>
          </div>
        </div>
      </article>

      <section className="card mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="flex items-center gap-2 font-bold text-slate-900"><Send size={17} className="text-blue-600" /> Delivery center</h2><p className="mt-1 text-xs text-slate-500">Send the PDF to this party and review every delivery attempt.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(sendingChannel) || !invoice.party.email} onClick={() => void sendThroughProvider('EMAIL')} className="btn-secondary inline-flex items-center gap-2 text-blue-700">{sendingChannel === 'EMAIL' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Send PDF by email</button><button type="button" disabled={Boolean(sendingChannel) || !(invoice.party.whatsappNumber || invoice.party.phone)} onClick={() => void sendThroughProvider('WHATSAPP')} className="btn-secondary inline-flex items-center gap-2 text-emerald-700">{sendingChannel === 'WHATSAPP' ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} Send PDF by WhatsApp</button></div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[280px_1fr]">
          <div className="rounded-xl bg-slate-50 p-4 text-xs"><p className="font-bold uppercase tracking-wider text-slate-400">Party destinations</p><div className="mt-3 space-y-2"><p className="flex items-center gap-2 text-slate-700"><Mail size={14} className="text-blue-500" /> {invoice.party.email || 'No email saved'}</p><p className="flex items-center gap-2 text-slate-700"><MessageCircle size={14} className="text-emerald-500" /> {invoice.party.whatsappNumber || invoice.party.phone || 'No WhatsApp saved'}</p></div><p className="mt-4 border-t border-slate-200 pt-3 text-[10px] leading-4 text-slate-500">Party preference: <strong className="text-slate-700">{invoice.party.invoiceDeliveryMode === 'AUTOMATIC' ? `Automatic · ${(invoice.party.invoiceDeliveryChannel || 'BOTH').toLowerCase()}` : 'Manual'}</strong></p></div>
          <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivery history</p>{invoice.deliveries?.length ? <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{invoice.deliveries.map((delivery) => <div key={delivery.id} className="flex items-start justify-between gap-4 p-3"><div className="flex min-w-0 items-start gap-2.5">{delivery.status === 'SENT' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : delivery.status === 'FAILED' ? <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" /> : <Clock3 size={16} className="mt-0.5 shrink-0 text-amber-500" />}<div className="min-w-0"><p className="text-xs font-bold text-slate-800">{delivery.channel === 'EMAIL' ? 'Email' : 'WhatsApp'} · {delivery.status.toLowerCase()}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{delivery.recipient || 'Missing recipient'}</p>{delivery.errorMessage && <p className="mt-1 text-[10px] leading-4 text-red-600">{delivery.errorMessage}</p>}</div></div><p className="shrink-0 text-[10px] text-slate-400">{new Date(delivery.attemptedAt).toLocaleString()}</p></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">No delivery attempts yet. Use automatic delivery during creation or send manually above.</div>}</div>
        </div>
      </section>

      {showPayment && (
        <PaymentModal
          invoiceId={invoice.id}
          maxAmount={balanceDue}
          onClose={() => setShowPayment(false)}
          onSaved={() => {
            setShowPayment(false);
            void loadInvoice();
          }}
        />
      )}
    </>
  );
}

function PaymentModal({ invoiceId, maxAmount, onClose, onSaved }: { invoiceId: string; maxAmount: number; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(maxAmount);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/invoices/${invoiceId}/payments`, { amount, method, reference: reference.trim() || undefined });
      onSaved();
    } catch (saveError: unknown) {
      setError(getApiError(saveError, 'Could not record payment.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Record payment" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div>
          <label htmlFor="payment-amount" className="label">Amount</label>
          <input id="payment-amount" type="number" required autoFocus min="0.01" max={maxAmount} step="0.01" className="input-field" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          <p className="mt-1.5 text-xs text-slate-500">Balance due: {formatCurrency(maxAmount)}</p>
        </div>
        <div>
          <label htmlFor="payment-method" className="label">Method</label>
          <select id="payment-method" className="input-field" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="payment-reference" className="label">Reference (optional)</label>
          <input id="payment-reference" className="input-field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction ID or cheque number" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary inline-flex min-w-24 items-center justify-center gap-2">
            {saving && <Loader2 aria-hidden="true" size={15} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
