'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
  RotateCcw,
  Send,
  Share2,
  XCircle,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { toast } from '@/components/ToastProvider';
import { api, getApiError } from '@/lib/api';
import { DOCUMENT_CONFIG } from '@/lib/documents';
import { formatCurrency, formatDate, formatQuantity, formatTransactionDate } from '@/lib/format';
import { getPreferences } from '@/lib/preferences';
import { renderMessage, whatsappLink } from '@/lib/messageTemplates';
import type { BusinessDocument, BusinessDocumentStatus, Invoice } from '@/types';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<BusinessDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [offerShare, setOfferShare] = useState(false);

  // Set by the document form when the company wants a WhatsApp share offered right after saving.
  useEffect(() => {
    setOfferShare(new URLSearchParams(window.location.search).get('share') === 'whatsapp');
  }, []);

  const loadDocument = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get<BusinessDocument>(`/documents/${id}`); setDocument(data); }
    catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load this document.')); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void loadDocument(); }, [loadDocument]);

  async function getPdfFile() {
    if (!document) throw new Error('Document not loaded');
    const { data } = await api.get<Blob>(`/documents/${document.id}/pdf`, { responseType: 'blob' });
    return new File([data], `${document.documentNumber}.pdf`, { type: 'application/pdf' });
  }

  async function downloadPdf() {
    if (!document) return;
    setBusy('download'); setError('');
    try {
      const file = await getPdfFile();
      const url = URL.createObjectURL(file);
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('PDF downloaded', { description: document.documentNumber });
    } catch (downloadError: unknown) { setError(getApiError(downloadError, 'Could not download the PDF.')); }
    finally { setBusy(''); }
  }

  async function printPdf() {
    setBusy('print'); setError('');
    try {
      const file = await getPdfFile();
      const url = URL.createObjectURL(file);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (printError: unknown) { setError(getApiError(printError, 'Could not open the printable PDF.')); }
    finally { setBusy(''); }
  }

  async function downloadAttachment(attachmentId: string, fileName: string) {
    if (!document) return;
    setBusy(`attachment-${attachmentId}`); setError('');
    try {
      const { data } = await api.get<Blob>(`/documents/${document.id}/attachments/${attachmentId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Attachment downloaded', { description: fileName });
    } catch (attachmentError: unknown) { setError(getApiError(attachmentError, 'Could not download the attachment.')); }
    finally { setBusy(''); }
  }

  function shareText() {
    if (!document) return '';
    const party = document.party?.name || document.supplier?.name || 'Party';
    if (document.party) {
      const message = getPreferences('message');
      const estimate = document.type === 'QUOTATION' || document.type === 'PROFORMA_INVOICE';
      return renderMessage(estimate ? message.estimateMessage : message.invoiceMessage, {
        FirmName: document.business?.legalName || document.business?.name || '',
        PartyName: document.party.name,
        InvoiceNumber: document.documentNumber,
        EstimateNumber: document.documentNumber,
        Amount: formatCurrency(document.grandTotal),
      });
    }
    return `${DOCUMENT_CONFIG[document.type].label} ${document.documentNumber}\n${party}\nTotal: ${formatCurrency(document.grandTotal)}\nIssued: ${formatDate(document.issueDate)}`;
  }

  async function nativeShare() {
    if (!document) return;
    setBusy('share'); setError('');
    try {
      const file = await getPdfFile();
      const shareData: ShareData = { title: `${DOCUMENT_CONFIG[document.type].label} ${document.documentNumber}`, text: shareText(), files: [file] };
      if (navigator.share && navigator.canShare?.(shareData)) await navigator.share(shareData);
      else if (navigator.share) await navigator.share({ title: shareData.title, text: shareData.text });
      else throw new Error('Native sharing is not available');
    } catch (shareError: unknown) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError('Native sharing is unavailable in this browser. Use WhatsApp, email, or download the PDF.');
    } finally { setBusy(''); }
  }

  function shareWhatsApp() {
    if (!document) return;
    const party = document.party || document.supplier;
    window.open(whatsappLink(document.party?.whatsappNumber || party?.phone, shareText()), '_blank', 'noopener,noreferrer');
  }

  function shareEmail() {
    if (!document) return;
    const email = document.party?.email || document.supplier?.email || '';
    const subject = `${DOCUMENT_CONFIG[document.type].label} ${document.documentNumber}`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${shareText()}\n\nPlease find the document details above. You can attach the downloaded PDF to this email.`)}`;
  }

  async function copySummary() {
    await navigator.clipboard.writeText(shareText()); setCopied(true); toast.success('Summary copied to clipboard'); window.setTimeout(() => setCopied(false), 1800);
  }

  async function changeStatus(status: BusinessDocumentStatus) {
    if (!document) return;
    setBusy(status); setError('');
    try { await api.patch(`/documents/${document.id}/status`, { status }); toast.warning('Document status updated', { description: status.toLowerCase().replaceAll('_', ' ') }); await loadDocument(); }
    catch (statusError: unknown) { setError(getApiError(statusError, 'Could not update document status.')); }
    finally { setBusy(''); }
  }

  async function convert(target: 'invoice' | 'proforma') {
    if (!document) return;
    setBusy(`convert-${target}`); setError('');
    try {
      if (target === 'invoice') {
        const { data } = await api.post<Invoice>(`/documents/${document.id}/convert-to-invoice`);
        toast.success('Converted to invoice', { description: data.invoiceNumber });
        router.push(`/invoices/${data.id}`);
      } else {
        const { data } = await api.post<BusinessDocument>(`/documents/${document.id}/convert-to-proforma`);
        toast.success('Converted to proforma invoice', { description: data.documentNumber });
        router.push(`/documents/${data.id}`);
      }
    } catch (convertError: unknown) { setError(getApiError(convertError, `Could not convert to ${target}.`)); }
    finally { setBusy(''); }
  }

  if (loading) return <><div className="card"><LoadingState label="Loading document..." /></div></>;
  if (!document || error && !document) return <><div className="card"><ErrorState message={error || 'Document not found.'} onRetry={loadDocument} /></div></>;

  const config = DOCUMENT_CONFIG[document.type];
  const party = document.supplier || document.party;
  const canConvert = !['CONVERTED', 'CANCELLED'].includes(document.status) && (document.type === 'QUOTATION' || document.type === 'PROFORMA_INVOICE');

  return (
    <>
      <PageHeader
        title={document.documentNumber}
        description={`${config.label} · ${party?.name || 'No party'} · Created ${formatDate(document.createdAt)}`}
        action={<div className="flex flex-wrap items-center justify-end gap-2"><Link href="/documents" className="btn-secondary inline-flex items-center gap-2"><ArrowLeft size={15} /> Back</Link><button type="button" onClick={() => void downloadPdf()} disabled={Boolean(busy)} className="btn-primary inline-flex items-center gap-2">{busy === 'download' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF</button></div>}
      />
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {offerShare && document.party && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">{config.label} saved. Share it with {document.party.name} on WhatsApp?</span>
          <span className="flex gap-2"><button type="button" onClick={() => { shareWhatsApp(); setOfferShare(false); }} className="btn-secondary inline-flex items-center gap-2 text-emerald-700"><MessageCircle aria-hidden="true" size={15} /> Share on WhatsApp</button><button type="button" onClick={() => setOfferShare(false)} className="btn-secondary">Not now</button></span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="card overflow-hidden">
          <div className={`h-2 ${config.soft}`}><div className={`h-full w-1/3 ${config.accent.replace('text-', 'bg-')}`} /></div>
          <div className="p-5 sm:p-7">
            <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row">
              <div><p className={`text-xs font-bold uppercase tracking-[0.16em] ${config.accent}`}>{document.business?.name || 'Business document'}</p><h1 className="mt-2 text-2xl font-black text-slate-950">{config.label}</h1><p className="mt-1 font-mono text-sm font-semibold text-slate-500">{document.documentNumber}</p></div>
              <div className="text-left sm:text-right"><StatusBadge status={document.status} /><p className="mt-3 text-xs text-slate-500">Issue date</p><p className="font-semibold text-slate-800">{formatTransactionDate(document.issueDate, document.createdAt)}</p></div>
            </header>

            <div className="grid gap-5 border-b border-slate-200 py-6 sm:grid-cols-2">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{document.supplier ? 'Supplier' : 'Bill to'}</p><p className="mt-2 text-base font-bold text-slate-900">{party?.name || '—'}</p><p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">{document.party?.billingAddr || document.supplier?.address || ''}</p>{party?.gstin && <p className="mt-1 text-xs font-semibold text-slate-600">GSTIN: {party.gstin}</p>}</div>
              <div className="grid grid-cols-2 gap-4 sm:text-right"><Info label="Valid until" value={formatDate(document.validUntil)} /><Info label="Due date" value={formatDate(document.dueDate)} /><Info label="Reference" value={document.referenceNumber || '—'} /><Info label="Place of supply" value={document.placeOfSupply || '—'} />{document.referenceInvoice && <Info label="Against invoice" value={document.referenceInvoice.invoiceNumber} />}{document.sourceDocument && <Info label="Converted from" value={document.sourceDocument.documentNumber} />}</div>
            </div>

            {(document.transportName || document.vehicleNumber || document.eWayBillNumber) && <div className="grid grid-cols-3 gap-4 border-b border-slate-200 py-5"><Info label="Transport" value={document.transportName || '—'} /><Info label="Vehicle" value={document.vehicleNumber || '—'} /><Info label="E-way bill" value={document.eWayBillNumber || '—'} /></div>}

            <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-900 text-left text-[10px] uppercase tracking-wider text-slate-300"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{document.items?.map((item, index) => <tr key={item.id}><td className="px-4 py-3 text-slate-400">{index + 1}</td><td className="px-4 py-3"><p className="font-semibold text-slate-800">{item.description}</p>{item.hsnSac && <p className="mt-0.5 text-[10px] text-slate-400">HSN/SAC {item.hsnSac}</p>}</td><td className="px-4 py-3 text-right text-slate-600">{formatQuantity(item.quantity)} {item.unit}</td><td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td><td className="px-4 py-3 text-right text-slate-600">{Number(item.taxRate).toFixed(2)}%</td><td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(item.lineTotal)}</td></tr>)}</tbody></table>
            </div>

            {document.attachments?.length ? (
              <div className="mb-6 border-b border-slate-200 pb-6">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Purchase bill files</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {document.attachments.map((attachment) => (
                    <button key={attachment.id} type="button" onClick={() => void downloadAttachment(attachment.id, attachment.fileName)} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                      {busy === `attachment-${attachment.id}` ? <Loader2 size={16} className="shrink-0 animate-spin text-blue-600" /> : <FileCheck2 size={16} className="shrink-0 text-blue-600" />}
                      <span className="min-w-0"><strong className="block truncate text-xs text-slate-700">{attachment.fileName}</strong><small className="text-[10px] text-slate-400">{attachment.kind.toLowerCase()} · {(attachment.size / 1024 / 1024).toFixed(1)} MB</small></span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-[1fr_290px]"><div className="space-y-4 text-xs leading-5 text-slate-500">{document.paymentMethod && <div><p className="font-bold uppercase tracking-wider text-slate-400">Payment type</p><p className="mt-1 capitalize">{document.paymentMethod.replaceAll('_', ' ')}</p></div>}{document.reason && <div><p className="font-bold uppercase tracking-wider text-slate-400">Reason</p><p className="mt-1 whitespace-pre-line">{document.reason}</p></div>}{document.terms && <div><p className="font-bold uppercase tracking-wider text-slate-400">Terms and conditions</p><p className="mt-1 whitespace-pre-line">{document.terms}</p></div>}{document.notes && <div className="rounded-lg bg-indigo-50 p-3 text-indigo-700"><strong>Notes:</strong> {document.notes}</div>}</div><div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between py-1.5"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(document.subTotal)}</span></div><div className="flex justify-between py-1.5"><span className="text-slate-500">Tax</span><span>{formatCurrency(document.taxTotal)}</span></div><div className="flex justify-between py-1.5"><span className="text-slate-500">Discount</span><span>-{formatCurrency(document.discount)}</span></div><div className="mt-2 flex justify-between border-t-2 border-blue-600 pt-3 text-lg font-black text-slate-950"><span>Total</span><span>{formatCurrency(document.grandTotal)}</span></div></div></div>
          </div>
        </article>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="card p-4"><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Share and export</h2><div className="grid grid-cols-2 gap-2"><ActionButton icon={MessageCircle} label="WhatsApp" onClick={shareWhatsApp} tone="text-emerald-700 bg-emerald-50 hover:bg-emerald-100" /><ActionButton icon={Mail} label="Email" onClick={shareEmail} tone="text-blue-700 bg-blue-50 hover:bg-blue-100" /><ActionButton icon={Share2} label="Share PDF" loading={busy === 'share'} onClick={() => void nativeShare()} tone="text-indigo-700 bg-indigo-50 hover:bg-indigo-100" /><ActionButton icon={Printer} label="Print" loading={busy === 'print'} onClick={() => void printPdf()} tone="text-slate-700 bg-slate-100 hover:bg-slate-200" /><ActionButton icon={Download} label="Download" loading={busy === 'download'} onClick={() => void downloadPdf()} tone="text-violet-700 bg-violet-50 hover:bg-violet-100" /><ActionButton icon={copied ? CheckCircle2 : Copy} label={copied ? 'Copied' : 'Copy details'} onClick={() => void copySummary()} tone="text-amber-700 bg-amber-50 hover:bg-amber-100" /></div></section>

          {canConvert && <section className="card p-4"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Convert document</h2><p className="mt-2 text-xs leading-5 text-slate-500">Reuse all party, tax, and line details without entering them again.</p><div className="mt-3 space-y-2">{document.type === 'QUOTATION' && <button type="button" disabled={Boolean(busy)} onClick={() => void convert('proforma')} className="btn-secondary flex w-full items-center justify-center gap-2"><RotateCcw size={15} /> Convert to proforma</button>}<button type="button" disabled={Boolean(busy)} onClick={() => void convert('invoice')} className="btn-primary flex w-full items-center justify-center gap-2">{busy === 'convert-invoice' ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />} Convert to invoice</button></div></section>}

          {!['CONVERTED', 'CANCELLED'].includes(document.status) && <section className="card p-4"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Workflow status</h2><div className="mt-3 space-y-2">{document.status === 'DRAFT' && <button type="button" onClick={() => void changeStatus('ISSUED')} disabled={Boolean(busy)} className="btn-primary flex w-full items-center justify-center gap-2"><Send size={15} /> Mark as issued</button>}{document.status === 'ISSUED' && <><button type="button" onClick={() => void changeStatus('ACCEPTED')} disabled={Boolean(busy)} className="btn-secondary flex w-full items-center justify-center gap-2 text-emerald-700"><FileCheck2 size={15} /> Mark accepted</button><button type="button" onClick={() => void changeStatus('REJECTED')} disabled={Boolean(busy)} className="btn-secondary flex w-full items-center justify-center gap-2 text-red-600"><XCircle size={15} /> Mark rejected</button></>}<button type="button" onClick={() => void changeStatus('CANCELLED')} disabled={Boolean(busy)} className="w-full rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">Cancel document</button></div></section>}
        </aside>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-semibold text-slate-700">{value}</p></div>;
}

function ActionButton({ icon: Icon, label, onClick, tone, loading = false }: { icon: typeof Download; label: string; onClick: () => void; tone: string; loading?: boolean }) {
  return <button type="button" disabled={loading} onClick={onClick} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl text-xs font-semibold transition disabled:opacity-60 ${tone}`}>{loading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}{label}</button>;
}
