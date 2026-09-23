'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, Download, File as FileIcon, FileCheck2, FilePlus2, FileSpreadsheet, FileText, Loader2, Mail, MessageCircle, Phone, Plus, ReceiptText, Save, Share2, Trash2, UserRound, X } from 'lucide-react';
import { api, getActiveBusinessId, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { prepareUploads } from '@/lib/imageCompression';
import type { Business, Invoice, Item, Party } from '@/types';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';
import DocumentCompanyPicker from '@/components/DocumentCompanyPicker';
import { toast } from '@/components/ToastProvider';
import { calculateInvoice, totalsOptionsFor, type InvoiceDraftLine } from './invoiceTotals';
import { usePreferences } from '@/lib/useGeneralPreferences';
import { renderMessage, whatsappLink } from '@/lib/messageTemplates';
import styles from './InvoiceForm.module.css';

type InvoiceShareTarget = 'pdf' | 'document' | 'excel' | 'whatsapp' | 'email';

function escapeMarkup(value: string | number) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const generateLineId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if randomUUID fails in insecure context
    }
  }
  return 'line_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
};

const emptyLine = (): InvoiceDraftLine => ({
  key: generateLineId(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
});

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type InvoiceAttachment = {
  id: string;
  file: File;
  kind: 'image' | 'document';
  previewUrl?: string;
};

export default function InvoiceForm({ onClose, onBusyChange }: { onClose: () => void; onBusyChange?: (busy: boolean) => void }) {
  const router = useRouter();
  const { initialPartyId = '' } = useEmbeddedForm();
  const [parties, setParties] = useState<Party[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState(() => getActiveBusinessId() ?? '');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleMode, setSaleMode] = useState<'CREDIT' | 'CASH'>('CREDIT');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceNumber, setInvoiceNumber] = useState('Assigned on save');
  const [manualNumberMode, setManualNumberMode] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const dueDateEdited = useRef(false);
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [lines, setLines] = useState<InvoiceDraftLine[]>(() => [emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState<'SAVE' | `SHARE_${InvoiceShareTarget}` | ''>('');
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const transactionPrefs = usePreferences('transaction');
  const taxPrefs = usePreferences('taxes');
  const partyPrefs = usePreferences('party');
  const messagePrefs = usePreferences('message');
  const busyRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<InvoiceAttachment[]>([]);

  const setBusy = useCallback((busy: boolean) => {
    busyRef.current = busy;
    onBusyChange?.(busy);
  }, [onBusyChange]);

  const loadData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const companyConfig = { signal, headers: businessId ? { 'X-Business-Id': businessId } : undefined };
      const [partyResponse, itemResponse, businessResponse] = await Promise.all([
        getAllPages<Party>('/parties', companyConfig),
        getAllPages<Item>('/items', companyConfig),
        getAllPages<Business>('/businesses', { signal }),
      ]);
      if (signal.aborted) return;
      setParties(partyResponse.data || []);
      setCatalog(itemResponse.data || []);
      setBusinesses(businessResponse.data || []);

      const selectedId = businessId || getActiveBusinessId() || businessResponse.data?.[0]?.id || '';
      const business = (businessResponse.data || []).find(({ id }) => id === selectedId) ?? businessResponse.data?.[0];
      if (business) {
        setBusinessId(business.id);
        setGstRegistered(Boolean(business.gstRegistered));
      }

      const queryPartyId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('partyId') : null;
      const requested = initialPartyId || queryPartyId || '';
      const requestedParty = requested ? partyResponse.data.find(({ id }) => id === requested) : undefined;
      if (requestedParty) {
        setPartyId(requestedParty.id);
        setCustomerPhone(requestedParty.phone || '');
      }
    } catch (loadFailure) {
      if (!signal.aborted) {
        setLoadError(getApiError(loadFailure, 'Could not load customers and items. Please try again.'));
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [businessId, initialPartyId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, loadVersion]);

  useEffect(() => {
    const controller = new AbortController();
    void api.get<{ invoiceNumber: string; manual?: boolean }>('/invoices/next-number', { signal: controller.signal, headers: businessId ? { 'X-Business-Id': businessId } : undefined })
      .then(({ data }) => {
        if (!controller.signal.aborted && data?.invoiceNumber) {
          setInvoiceNumber(data.invoiceNumber);
          setManualNumberMode(Boolean(data.manual));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [businessId]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Default due date = invoice date + the company's payment term, until the user picks one.
  useEffect(() => {
    if (dueDateEdited.current || !invoiceDate) return;
    const days = partyPrefs.defaultPaymentTermDays;
    if (days <= 0) { setDueDate(''); return; }
    const due = new Date(`${invoiceDate}T00:00:00`);
    due.setDate(due.getDate() + days);
    setDueDate(`${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`);
  }, [invoiceDate, partyPrefs.defaultPaymentTermDays]);

  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach(({ previewUrl }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
  }, []);

  function updateLine(key: string, patch: Partial<InvoiceDraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function pickItem(key: string, itemId: string) {
    const item = catalog.find(({ id }) => id === itemId);
    updateLine(
      key,
      item
        ? {
            itemId,
            description: item.name,
            unitPrice: Number(item.salePrice || 0),
            taxRate: gstRegistered ? Number(item.taxRate || 0) : 0,
          }
        : { itemId: undefined },
    );
  }

  function selectParty(nextPartyId: string) {
    const party = parties.find(({ id }) => id === nextPartyId);
    setPartyId(nextPartyId);
    setCustomerPhone(party?.phone || '');
  }

  function addAttachments(event: ChangeEvent<HTMLInputElement>, kind: InvoiceAttachment['kind']) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    const availableSlots = Math.max(0, 10 - attachments.length);
    let availableBytes = Math.max(0, 25 * 1024 * 1024 - attachments.reduce((sum, entry) => sum + entry.file.size, 0));
    const accepted = selected.filter((file) => {
      if (file.size > 10 * 1024 * 1024 || file.size > availableBytes) return false;
      availableBytes -= file.size;
      return true;
    }).slice(0, availableSlots);

    if (accepted.length !== selected.length) {
      setError('You can add up to 10 files and 25 MB total. Each file must be 10 MB or smaller.');
    }

    setAttachments((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: generateLineId(),
        file,
        kind,
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
      })),
    ]);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const attachment = current.find((entry) => entry.id === id);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }

  const totalOptions = useMemo(() => totalsOptionsFor(transactionPrefs, taxPrefs), [transactionPrefs, taxPrefs]);
  const totals = useMemo(() => calculateInvoice(lines, discount, gstRegistered, totalOptions), [lines, discount, gstRegistered, totalOptions]);
  const selectedParty = parties.find(({ id }) => id === partyId);
  const disabled = loading || Boolean(loadError) || Boolean(saving) || Boolean(savedId);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  function invoiceMessage(invoice: Invoice) {
    return renderMessage(messagePrefs.invoiceMessage, {
      FirmName: businesses.find(({ id }) => id === businessId)?.name ?? '',
      PartyName: selectedParty?.name ?? '',
      InvoiceNumber: invoice.invoiceNumber,
      Amount: formatCurrency(invoice.grandTotal),
    });
  }

  async function shareWithAttachments(invoice: Invoice) {
    if (!attachments.length || typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    const { data: pdf } = await api.get(`/invoices/${invoice.id}/pdf`, {
      responseType: 'blob',
      headers: { 'X-Business-Id': businessId },
    });
    const files = [
      new File([pdf], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' }),
      ...attachments.map(({ file }) => file),
    ];
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) return false;
    await navigator.share({
      title: `Invoice ${invoice.invoiceNumber}`,
      text: invoiceMessage(invoice),
      files,
    });
    return true;
  }

  function invoiceExportMarkup(invoice: Invoice, enteredLines: InvoiceDraftLine[]) {
    const rows = enteredLines.map((line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeMarkup(line.description)}</td>
          <td>${escapeMarkup(line.quantity)}</td>
          <td>${escapeMarkup(line.unitPrice)}</td>
          <td>${escapeMarkup(line.taxRate)}%</td>
          <td>${escapeMarkup(calculateInvoice([line], 0, gstRegistered, { noTax: totalOptions.noTax }).total)}</td>
        </tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#172033}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3dc;padding:8px;text-align:left}th{background:#eef3f8}.total{text-align:right;font-size:18px;font-weight:700;margin-top:16px}</style></head><body><h1>Sale Invoice</h1><p><strong>Invoice:</strong> ${escapeMarkup(invoice.invoiceNumber)}</p><p><strong>Customer:</strong> ${escapeMarkup(selectedParty?.name || '')}</p><p><strong>Date:</strong> ${escapeMarkup(invoiceDate)}</p><table><thead><tr><th>#</th><th>Item details</th><th>Qty</th><th>Price / unit</th><th>Tax</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: ${escapeMarkup(invoice.grandTotal)}</p></body></html>`;
  }

  async function runInvoiceShare(target: InvoiceShareTarget, invoice: Invoice, enteredLines: InvoiceDraftLine[]) {
    const fileBase = invoice.invoiceNumber || 'sale-invoice';
    if (target === 'pdf') {
      const { data } = await api.get<Blob>(`/invoices/${invoice.id}/pdf`, { responseType: 'blob', headers: { 'X-Business-Id': businessId } });
      downloadFile(new Blob([data], { type: 'application/pdf' }), `${fileBase}.pdf`);
      return;
    }
    if (target === 'document') return downloadFile(new Blob([invoiceExportMarkup(invoice, enteredLines)], { type: 'application/msword;charset=utf-8' }), `${fileBase}.doc`);
    if (target === 'excel') return downloadFile(new Blob([invoiceExportMarkup(invoice, enteredLines)], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${fileBase}.xls`);
    if (target === 'email') {
      const message = invoiceMessage(invoice);
      window.open(`mailto:${encodeURIComponent(selectedParty?.email || '')}?subject=${encodeURIComponent(`Invoice ${invoice.invoiceNumber}`)}&body=${encodeURIComponent(message)}`, '_blank');
      return;
    }
    const sharedFromDevice = await shareWithAttachments(invoice);
    if (!sharedFromDevice) window.open(whatsappLink(selectedParty?.phone || customerPhone, invoiceMessage(invoice)), '_blank', 'noopener,noreferrer');
  }

  async function submit(action: 'SAVE' | InvoiceShareTarget) {
    if (busyRef.current || disabled) return;
    setError('');
    const enteredLines = lines.filter((line) => (line.description || '').trim() || line.itemId || (line.unitPrice ?? 0) !== 0);
    if (!partyId) return setError('Select a customer before saving this invoice.');
    if (manualNumberMode && !manualNumber.trim()) return setError('Enter an invoice number.');
    const normalizedPhone = customerPhone.replace(/[\s()-]/g, '');
    if (normalizedPhone && !/^\+?[0-9]{7,15}$/.test(normalizedPhone)) {
      return setError('Enter a valid customer phone number with 7 to 15 digits.');
    }
    if (!invoiceDate || (dueDate && dueDate < invoiceDate)) return setError('Choose an invoice date and a due date on or after it.');
    if (!enteredLines.length) return setError('Add at least one item with a description.');
    if (
      enteredLines.some(
        (line) =>
          !(line.description || '').trim() ||
          line.description.length > 200 ||
          !Number.isFinite(line.quantity) ||
          line.quantity < 0.01 ||
          !Number.isFinite(line.unitPrice) ||
          line.unitPrice < 0 ||
          !Number.isFinite(line.taxRate) ||
          line.taxRate < 0 ||
          line.taxRate > 100,
      )
    ) {
      return setError('Check each item: enter a description, a positive quantity, a non-negative price, and tax between 0 and 100%.');
    }
    const safeDiscount = Number.isFinite(discount) ? discount : 0;
    if (safeDiscount < 0 || safeDiscount > totals.subtotal + totals.tax) {
      return setError('Discount must be between zero and the invoice amount.');
    }
    const invoiceNotes = [
      notes.trim(),
      terms.trim() && `Terms & conditions\n${terms.trim()}`,
    ].filter(Boolean).join('\n\n');
    if (invoiceNotes.length > 5000) return setError('Notes and terms together must be 5,000 characters or fewer.');

    setBusy(true);
    setSaving(action === 'SAVE' ? 'SAVE' : `SHARE_${action}`);
    let createdId = '';
    try {
      const requestConfig = { headers: { 'X-Business-Id': businessId } };
      if (selectedParty && normalizedPhone !== (selectedParty.phone || '').replace(/[\s()-]/g, '')) {
        const { data: updatedParty } = await api.patch<Party>(
          `/parties/${selectedParty.id}`,
          { phone: normalizedPhone || undefined },
          requestConfig,
        );
        setParties((current) => current.map((party) => party.id === updatedParty.id ? updatedParty : party));
      }
      const { data } = await api.post<Invoice>('/invoices', {
        partyId,
        invoiceNumber: manualNumberMode ? manualNumber.trim() : undefined,
        issueDate: invoiceDate,
        dueDate: dueDate || undefined,
        discount: safeDiscount,
        notes: invoiceNotes || undefined,
        deliveryMode: 'MANUAL',
        items: enteredLines.map((line) => ({
          itemId: line.itemId,
          description: (line.description || '').trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
        })),
      }, requestConfig);
      createdId = data.id;
      setSavedId(data.id);
      if (attachments.length) {
        const formData = new FormData();
        (await prepareUploads(attachments.map(({ file }) => file))).forEach((file) => formData.append('files', file, file.name));
        await api.post(`/invoices/${data.id}/attachments`, formData, {
          headers: { 'X-Business-Id': businessId, 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
      }
      if (saleMode === 'CASH' && Number(data.grandTotal) > 0) {
        await api.post(`/invoices/${data.id}/payments`, { amount: Number(data.grandTotal), method: paymentMethod }, requestConfig);
      }
      if (action !== 'SAVE') await runInvoiceShare(action, data, enteredLines);
      toast.success(action === 'SAVE' ? 'Invoice saved' : 'Invoice saved and shared', { description: `${data.invoiceNumber} · ${formatCurrency(data.grandTotal)}` });
      router.push(`/invoices/${data.id}?companyId=${encodeURIComponent(businessId)}${action === 'SAVE' && messagePrefs.autoShareOnSave ? '&share=whatsapp' : ''}`);
    } catch (saveFailure) {
      const message = createdId
          ? 'Invoice saved, but an attachment, payment, or sharing step could not be completed. Open the saved invoice to review it.'
          : getApiError(saveFailure, 'Could not save the invoice. Your details are still here.');
      setError(message);
      toast.error(createdId ? 'Invoice partially completed' : 'Invoice was not saved', { description: message, duration: 7000 });
    } finally {
      setBusy(false);
      setSaving('');
    }
  }

  return (
    <div className={styles.editor}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={Boolean(saving)} aria-label="Close invoice">
            <ArrowLeft size={20} />
          </button>
          <span className={styles.headerIcon}>
            <ReceiptText size={22} />
          </span>
          <div>
            <div className={styles.titleRow}>
              <h1>New invoice</h1>
              <span className={styles.draft}>{savedId ? 'Saved' : 'Unsaved'}</span>
            </div>
            <p>Create a sale invoice for your customer</p>
          </div>
        </div>
        <div className={styles.headerEnd}>
          <div className={styles.headerPayment}>
            <span>Payment type</span>
            <div className={styles.paymentToggle} aria-label="Payment type">
              {(['CASH', 'CREDIT'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={saleMode === mode}
                  className={saleMode === mode ? styles.paymentSelected : ''}
                  onClick={() => setSaleMode(mode)}
                >
                  {mode === 'CASH' ? 'Cash' : 'Credit'}
                </button>
              ))}
            </div>
          </div>
          <DocumentCompanyPicker
            businesses={businesses}
            value={businessId}
            disabled={Boolean(saving) || Boolean(savedId)}
            onChange={(nextId) => {
              setBusinessId(nextId);
              setGstRegistered(Boolean(businesses.find(({ id }) => id === nextId)?.gstRegistered));
            }}
          />
          {manualNumberMode ? (
            <input
              aria-label="Invoice number"
              className={styles.invoiceNumber}
              value={manualNumber}
              maxLength={40}
              placeholder="Invoice no. *"
              disabled={Boolean(saving) || Boolean(savedId)}
              onChange={(event) => setManualNumber(event.target.value)}
            />
          ) : (
            <span className={styles.invoiceNumber}>{invoiceNumber}</span>
          )}
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={Boolean(saving)} aria-label="Close invoice editor">
            <X size={20} />
          </button>
        </div>
      </header>

      <main className={styles.scrollArea}>
        <div className={styles.workspace}>
          <div className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>SALES / CREATE INVOICE</span>
              <h2>Let’s get the details right.</h2>
              <p>Add your customer and items. We’ll calculate the rest.</p>
            </div>
            <span className={styles.requiredNote}>* Required fields</span>
          </div>

          {(error || loadError) && (
            <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
              <AlertCircle size={18} />
              <div>
                {error || loadError}
                {loadError && (
                  <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>
                    Try again
                  </button>
                )}
                {savedId && (
                  <button type="button" onClick={() => router.push(`/invoices/${savedId}?companyId=${encodeURIComponent(businessId)}`)}>
                    Open saved invoice <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          <fieldset disabled={disabled} className={styles.formLayout}>
            <legend className="sr-only">Invoice details</legend>
            <div className={styles.primaryColumn}>
              <section className={styles.card}>
                <SectionHeading icon={<UserRound size={18} />} title="Customer details" description="Who are you billing?" />
                <div className={styles.cardBody}>
                  <div className={styles.customerFields}>
                  <Field label="Customer *">
                    <select className={styles.input} value={partyId} onChange={(event) => selectParty(event.target.value)}>
                      <option value="">{loading ? 'Loading customers…' : 'Select a customer'}</option>
                      {parties.map((party) => (
                        <option key={party.id} value={party.id}>
                          {party.name}{party.phone ? ` · ${party.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Phone number">
                    <div className={styles.phoneInput}>
                      <Phone size={16} aria-hidden="true" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        className={styles.input}
                        value={customerPhone}
                        placeholder="Enter contact number"
                        onChange={(event) => setCustomerPhone(event.target.value.replace(/[^0-9+ ()-]/g, ''))}
                      />
                    </div>
                  </Field>
                  </div>
                  {selectedParty ? (
                    <div className={styles.customerDetails}>
                      <div className={styles.customerIdentity}>
                        <span className={styles.avatar}>{(selectedParty.name || 'CU').slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{selectedParty.name}</strong>
                          <p>{customerPhone || selectedParty.email || 'No contact details'}</p>
                        </div>
                        <span className={styles.balance}>
                          Balance due<strong>{formatCurrency(selectedParty.balanceDue ?? 0)}</strong>
                        </span>
                      </div>
                      <div className={styles.addressGrid}>
                        <div>
                          <span>Billing address</span>
                          <p>{selectedParty.billingAddr || 'No billing address added'}</p>
                        </div>
                        <div>
                          <span>Shipping address</span>
                          <p>{selectedParty.shippingAddr || selectedParty.billingAddr || 'No shipping address added'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.customerPlaceholder}>
                      <UserRound size={18} />
                      <p>Select a customer to see their contact details and addresses.</p>
                    </div>
                  )}
                  {!loading && !loadError && parties.length === 0 && (
                    <p className={styles.help}>Add a customer in Parties before creating an invoice.</p>
                  )}
                </div>
              </section>

              <section className={`${styles.card} ${styles.itemsCard}`}>
                <SectionHeading
                  icon={<ReceiptText size={18} />}
                  title="Items & services"
                  description="Choose from your catalog or enter a custom item."
                  trailing={<span className={styles.count}>{totals.count} {totals.count === 1 ? 'item' : 'items'}</span>}
                />
                <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Invoice items; scroll horizontally to view all columns">
                  <table className={styles.table}>
                    <caption className="sr-only">Invoice items, quantities, prices, taxes and amounts</caption>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Item / description</th>
                        <th scope="col">Qty</th>
                        <th scope="col">Rate (₹)</th>
                        <th scope="col">Tax %</th>
                        <th scope="col">Amount</th>
                        <th scope="col">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={line.key}>
                          <td className={styles.rowNumber}>{String(index + 1).padStart(2, '0')}</td>
                          <td>
                            <select
                              aria-label={`Item ${index + 1}`}
                              className={styles.itemSelect}
                              value={line.itemId ?? ''}
                              onChange={(event) => pickItem(line.key, event.target.value)}
                            >
                              <option value="">Items</option>
                              {catalog.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label={`Description ${index + 1}`}
                              className={styles.descriptionInput}
                              maxLength={200}
                              placeholder="Enter item description"
                              value={line.description}
                              onChange={(event) => updateLine(line.key, { description: event.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Quantity ${index + 1}`}
                              type="number"
                              min="0.01"
                              step="any"
                              className={styles.cellInput}
                              value={isNaN(line.quantity) ? '' : line.quantity}
                              onChange={(event) => updateLine(line.key, { quantity: parseFloat(event.target.value) || 0 })}
                            />
                            {line.itemId && (
                              <span className={styles.unit}>{catalog.find(({ id }) => id === line.itemId)?.unit}</span>
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`Rate ${index + 1}`}
                              type="number"
                              min="0"
                              step="0.01"
                              className={styles.cellInput}
                              value={isNaN(line.unitPrice) ? '' : line.unitPrice}
                              readOnly={!transactionPrefs.editPriceOnInvoice && Boolean(line.itemId)}
                              title={!transactionPrefs.editPriceOnInvoice && line.itemId ? 'Price editing is turned off in Transaction settings' : undefined}
                              onChange={(event) => updateLine(line.key, { unitPrice: parseFloat(event.target.value) || 0 })}
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Tax ${index + 1}`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className={styles.cellInput}
                              value={isNaN(line.taxRate) ? '' : line.taxRate}
                              onChange={(event) => updateLine(line.key, { taxRate: parseFloat(event.target.value) || 0 })}
                            />
                          </td>
                          <td className={styles.amount}>{formatCurrency(totals.lines[index]?.total ?? 0)}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              aria-label={`Remove item ${index + 1}`}
                              onClick={() =>
                                setLines((current) => (current.length === 1 ? [emptyLine()] : current.filter(({ key }) => key !== line.key)))
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tableFooter}>
                  <button
                    type="button"
                    className={styles.addButton}
                    disabled={lines.length >= 200}
                    onClick={() => setLines((current) => [...current, emptyLine()])}
                  >
                    <Plus size={16} /> Add item
                  </button>
                  {transactionPrefs.additionalCharges && (
                    <button
                      type="button"
                      className={styles.addButton}
                      disabled={lines.length >= 200}
                      onClick={() => setLines((current) => [...current, { ...emptyLine(), description: 'Additional charge' }])}
                    >
                      <Plus size={16} /> Add charge
                    </button>
                  )}
                  <span>{totals.quantity} total quantity</span>
                </div>
              </section>

              <section className={styles.card}>
                <SectionHeading
                  icon={<FileText size={18} />}
                  title="Additional details"
                  description="A little context for your customer."
                  trailing={<span className={styles.optional}>Optional</span>}
                />
                <div className={`${styles.cardBody} ${styles.notesGrid}`}>
                  <Field label="Invoice notes">
                    <textarea
                      className={styles.input}
                      rows={3}
                      maxLength={5000}
                      placeholder="Add a message or reference for this invoice…"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </Field>
                  <Field label="Terms & conditions">
                    <textarea
                      className={styles.input}
                      rows={3}
                      maxLength={5000}
                      placeholder="Payment terms, delivery information…"
                      value={terms}
                      onChange={(event) => setTerms(event.target.value)}
                    />
                  </Field>
                  <div className={styles.attachmentSection}>
                    <div className={styles.attachmentButtons}>
                      <input
                        ref={imageInputRef}
                        className={styles.hiddenFileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={(event) => addAttachments(event, 'image')}
                      />
                      <input
                        ref={documentInputRef}
                        className={styles.hiddenFileInput}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        multiple
                        onChange={(event) => addAttachments(event, 'document')}
                      />
                      <button type="button" className={styles.uploadButton} onClick={() => imageInputRef.current?.click()}>
                        <Camera size={17} />
                        <span>Add images<small>PNG, JPG or WebP</small></span>
                      </button>
                      <button type="button" className={styles.uploadButton} onClick={() => documentInputRef.current?.click()}>
                        <FilePlus2 size={17} />
                        <span>Add documents<small>PDF, Word or spreadsheet</small></span>
                      </button>
                    </div>
                    {attachments.length > 0 && (
                      <div className={styles.attachmentList} aria-label="Selected attachments">
                        {attachments.map((attachment) => (
                          <div key={attachment.id} className={styles.attachmentChip}>
                            {attachment.previewUrl ? (
                              <Image src={attachment.previewUrl} width={36} height={36} unoptimized alt="" />
                            ) : (
                              <span className={styles.documentIcon}><FileCheck2 size={17} /></span>
                            )}
                            <span>
                              <strong>{attachment.file.name}</strong>
                              <small>{(attachment.file.size / 1024 / 1024).toFixed(1)} MB</small>
                            </span>
                            <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.file.name}`}><X size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className={styles.attachmentHelp}>Images and documents are saved with the invoice. Up to 10 files and 25 MB total.</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section className={styles.card}>
                <div className={styles.simpleHeading}>
                  <h3>Invoice details</h3>
                  <span className={styles.optional}>INR ₹</span>
                </div>
                <div className={`${styles.cardBody} ${styles.detailsFields}`}>
                  <div>
                    <span className={styles.fieldLabel}>Invoice number</span>
                    <div className={styles.readonlyValue}>
                      {invoiceNumber}
                      <span>Auto-generated</span>
                    </div>
                  </div>
                  <div className={styles.dateGrid}>
                    <Field label="Invoice date *">
                      <input
                        type="date"
                        className={styles.input}
                        required
                        value={invoiceDate}
                        onChange={(event) => setInvoiceDate(event.target.value)}
                      />
                    </Field>
                    <Field label="Due date">
                      <input
                        type="date"
                        className={styles.input}
                        min={invoiceDate}
                        value={dueDate}
                        onChange={(event) => { dueDateEdited.current = true; setDueDate(event.target.value); }}
                      />
                    </Field>
                  </div>
                  {saleMode === 'CASH' && (
                    <Field label="Payment method">
                      <select
                        className={styles.input}
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                  )}
                </div>
              </section>

              <section className={`${styles.card} ${styles.summary}`}>
                <div className={styles.simpleHeading}>
                  <h3>Invoice summary</h3>
                  <ReceiptText size={16} aria-hidden="true" />
                </div>
                <div className={styles.summaryBody}>
                  <div className={styles.summaryRow}>
                    <span>Subtotal</span>
                    <strong>{formatCurrency(totals.subtotal)}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Tax</span>
                    <strong>{formatCurrency(totals.tax)}</strong>
                  </div>
                  <label className={styles.discountRow}>
                    <span>
                      Discount <small>₹</small>
                    </span>
                    <input
                      aria-label="Invoice discount"
                      type="number"
                      min="0"
                      step="0.01"
                      max={totals.subtotal + totals.tax}
                      value={isNaN(discount) ? '' : discount}
                      onChange={(event) => setDiscount(parseFloat(event.target.value) || 0)}
                      className={styles.cellInput}
                    />
                  </label>
                  <div className={styles.grandTotal} aria-live="polite">
                    <span>Total amount</span>
                    <strong>{formatCurrency(totals.total)}</strong>
                    <small>Including {formatCurrency(totals.tax)} tax</small>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>{saleMode === 'CASH' ? 'Payment to record' : 'Balance due'}</span>
                    <strong>{formatCurrency(totals.total)}</strong>
                  </div>
                </div>
              </section>
              <p className={styles.summaryHint}>
                <Check size={15} /> Review your details before saving.
              </p>
            </aside>
          </fieldset>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTotal}>
          <span>Total amount</span>
          <strong>{formatCurrency(totals.total)}</strong>
          <small>
            {totals.count} {totals.count === 1 ? 'item' : 'items'}
          </small>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={onClose} disabled={Boolean(saving)} className={styles.cancelButton}>
            Cancel
          </button>
          <div
            className={styles.shareDropdown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setShareMenuOpen(false);
            }}
          >
            <button
              type="button"
              disabled={disabled}
              className={styles.shareButton}
              aria-haspopup="menu"
              aria-expanded={shareMenuOpen}
              onClick={() => setShareMenuOpen((open) => !open)}
            >
              {saving.startsWith('SHARE_') ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              Share <ChevronDown size={15} />
            </button>
            {shareMenuOpen && (
              <div className={styles.shareMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => void submit('pdf')}><Download size={16} /><span>PDF<small>Download printable PDF</small></span></button>
                <button type="button" role="menuitem" onClick={() => void submit('document')}><FileIcon size={16} /><span>Document<small>Download editable Word file</small></span></button>
                <button type="button" role="menuitem" onClick={() => void submit('excel')}><FileSpreadsheet size={16} /><span>Excel<small>Download spreadsheet</small></span></button>
                <button type="button" role="menuitem" onClick={() => void submit('whatsapp')}><MessageCircle size={16} /><span>WhatsApp<small>Share with customer</small></span></button>
                <button type="button" role="menuitem" onClick={() => void submit('email')}><Mail size={16} /><span>Email<small>Send to customer email</small></span></button>
              </div>
            )}
          </div>
          <button type="button" disabled={disabled} onClick={() => void submit('SAVE')} className={styles.saveButton}>
            {saving === 'SAVE' ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            <span>{saving === 'SAVE' ? 'Saving…' : 'Save and issue'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function SectionHeading({ icon, title, description, trailing }: { icon: ReactNode; title: string; description: string; trailing?: ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <span className={styles.sectionIcon}>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
}
