'use client';
import TransactionDetailsFields,{emptyTransactionDetails,transactionDetailsPayload} from '@/components/TransactionDetailsFields';
import { trackingFields } from '@/lib/tracking';
import { TrackingBlanks, TrackingCells, TrackingHeaders } from '@/components/TrackingCells';


import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, ArrowRight, CalendarDays, Camera, ChevronDown, Download, File as FileIcon, FileCheck2, FilePlus2, FileSpreadsheet, FileText, ListChecks, Loader2, Mail, MessageCircle, PlusCircle, Trash2, TrendingUp, X } from 'lucide-react';
import { api, getActiveBusinessId, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { prepareUploads } from '@/lib/imageCompression';
import type { Business, Invoice, Item, Party } from '@/types';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';
import { CHARGES, CompanyChip, EditorTabBar, GodownPill, GST_RATES, MetaRow, noCharges, PAYMENT_TERMS, SUPPLY_STATES, addDays, today } from '@/components/transactions/EditorParts';
import { toast } from '@/components/ToastProvider';
import { calculateInvoice, totalsOptionsFor, type InvoiceDraftLine } from './invoiceTotals';
import { normalizePreferences, type CompanyPreferences, type Preferences } from '@/lib/preferences';
import { usePreferences } from '@/lib/useGeneralPreferences';
import { renderMessage, whatsappLink } from '@/lib/messageTemplates';
import styles from '@/components/transactions/TransactionEditor.module.css';

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
  const [businessId, setBusinessId] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('companyId') : null) || getActiveBusinessId() || '');
  const [documentPreferences, setDocumentPreferences] = useState<CompanyPreferences | null>(null);
  const [gstRegistered, setGstRegistered] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [transactionInfo,setTransactionInfo]=useState(emptyTransactionDetails);
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saleMode, setSaleMode] = useState<'CREDIT' | 'CASH'>('CREDIT');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceNumber, setInvoiceNumber] = useState('Assigned on save');
  const [manualNumberMode, setManualNumberMode] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const termTouched = useRef(false);
  const [termDays, setTermDays] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState('');
  const discountByPercent = useRef(false);
  const [charges, setCharges] = useState(noCharges);
  const [roundOffChoice, setRoundOffChoice] = useState<boolean | null>(null);
  const [taxChoice, setTaxChoice] = useState<number | null>(null);
  const [lines, setLines] = useState<InvoiceDraftLine[]>(() => [emptyLine(), emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState<'SAVE' | `SHARE_${InvoiceShareTarget}` | ''>('');
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const [editingId,setEditingId]=useState('');
  const [sourceDraft,setSourceDraft]=useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const global_transactionPrefs = usePreferences('transaction');
  const transactionPrefs = documentPreferences?.transaction ?? global_transactionPrefs;
  const global_taxPrefs = usePreferences('taxes');
  const taxPrefs = documentPreferences?.taxes ?? global_taxPrefs;
  const global_partyPrefs = usePreferences('party');
  const partyPrefs = documentPreferences?.party ?? global_partyPrefs;
  const global_itemPrefs = usePreferences('item');
  const global_messagePrefs = usePreferences('message');
  const messagePrefs = documentPreferences?.message ?? global_messagePrefs;
  const busyRef = useRef(false);
  const saveRequestId=useRef(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():undefined);
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
      const params=new URLSearchParams(window.location.search);
      const recordBranch=params.get('branchId');
      const companyConfig = { signal, headers: businessId ? { 'X-Business-Id': businessId, ...(recordBranch?{'X-Branch-Id':recordBranch}:{}) } : undefined };
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
        const { data: preferences } = await api.get(`/businesses/${business.id}/preferences`, { signal });
        if (signal.aborted) return;
        setDocumentPreferences(normalizePreferences(preferences));
      }

      const editId=params.get('editId');
      const duplicateId = editId || params.get('duplicateId');
      setEditingId(editId||'');
      if (duplicateId) {
        const { data: source } = await api.get<Invoice>(`/invoices/${encodeURIComponent(duplicateId)}`, companyConfig);
        if (signal.aborted) return;
        setWarehouseId(source.warehouseId||'');
        setNotes(source.notes||'');
        if(editId){setSourceDraft(source.status==='DRAFT');setInvoiceNumber(source.invoiceNumber);setManualNumber(source.invoiceNumber);setManualNumberMode(!normalizePreferences(source.business?.preferences).transaction.autoNumbering);setInvoiceDate(source.issueDate.slice(0,10));termTouched.current=true;setTermDays(null);setDueDate(source.dueDate?.slice(0,10)||'');}
        setPartyId(source.party.id); setCustomerPhone(source.party.phone || ''); setDiscount(Number(source.discount));
        setTransactionInfo({...emptyTransactionDetails,...Object.fromEntries(Object.keys(emptyTransactionDetails).map(key=>[key,String((source as unknown as Record<string,unknown>)[key]??'')]))});
        setPlaceOfSupply(source.placeOfSupply || '');
        const chargeOf = (line: Invoice['items'][number]) => line.itemId || Number(line.quantity) !== 1 || Number(line.taxRate) ? undefined : CHARGES.find(([, , description]) => description === line.description)?.[0];
        setCharges(source.items.reduce((found, line) => { const key = chargeOf(line); return key ? { ...found, [key]: String(Number(line.unitPrice)) } : found; }, noCharges));
        const itemLines = source.items.filter((line) => !chargeOf(line));
        setLines(itemLines.length ? itemLines.map((line) => ({ ...trackingFields(line), unit:line.unit, hsnSac:line.hsnSac, key: generateLineId(), itemId: line.itemId, description: line.description, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: Number(line.taxRate), taxInclusive: line.taxInclusive })) : [emptyLine()]);
        if (source.notes) setShowDescription(true);
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
    if(new URLSearchParams(window.location.search).get('editId'))return;
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

  // Payment terms start from the company default until the user picks a term or a due date.
  useEffect(() => {
    if (!termTouched.current) setTermDays(Math.max(0, partyPrefs.defaultPaymentTermDays));
  }, [partyPrefs.defaultPaymentTermDays]);

  useEffect(() => {
    if (termDays !== null && invoiceDate) setDueDate(addDays(invoiceDate, termDays));
  }, [invoiceDate, termDays]);

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
            ...trackingFields(item),
          itemId,
            description: item.name,
            unit: item.unit,
            hsnSac: item.hsnSac,
            unitPrice: Number(item.salePrice || 0),
            taxRate: gstRegistered ? Number(item.taxRate || 0) : 0,
            taxInclusive: item.salePriceTaxMode === 'WITH_TAX',
          }
        : { itemId: undefined },
    );
  }

  /** Typing a catalog name links the item; other text is kept as the line description. */
  function typeItem(line: InvoiceDraftLine, text: string) {
    const match = catalog.find(({ name }) => name.toLowerCase() === text.trim().toLowerCase());
    if (match && match.id !== line.itemId) pickItem(line.key, match.id);
    else updateLine(line.key, text.trim() ? { description: text } : { description: '', itemId: undefined });
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

  const roundOff = roundOffChoice ?? Boolean(transactionPrefs.autoRoundOff);
  const totalOptions = useMemo(() => ({ ...totalsOptionsFor(transactionPrefs, taxPrefs), roundOff }), [transactionPrefs, taxPrefs, roundOff]);
  const newLine = () => ({ ...emptyLine(), taxRate: taxChoice ?? 0 });
  const chargeLines = useMemo(() => CHARGES.flatMap(([key, , description]): InvoiceDraftLine[] => {
    const amount = Number(charges[key]);
    return Number.isFinite(amount) && amount > 0 ? [{ ...emptyLine(), key: `charge-${key}`, description, unitPrice: amount }] : [];
  }), [charges]);
  // A negative adjustment cannot be a line (prices must be >= 0), so it is applied as extra discount.
  const adjustmentDiscount = Math.max(0, -(Number(charges.adjustment) || 0));
  const totals = useMemo(() => calculateInvoice([...lines, ...chargeLines], discount + adjustmentDiscount, gstRegistered, totalOptions), [lines, chargeLines, discount, adjustmentDiscount, gstRegistered, totalOptions]);
  const itemTotals = useMemo(() => calculateInvoice(lines, 0, gstRegistered, { noTax: totalOptions.noTax }), [lines, gstRegistered, totalOptions.noTax]);
  const discountBase = totals.subtotal + totals.tax;
  const showTax = gstRegistered && !totalOptions.noTax;
  // The sale screen always shows every tracking column, matching the reference layout.
  const trackingColumns: Preferences<'item'> = useMemo(() => ({ ...(documentPreferences?.item ?? global_itemPrefs), showSerial: true, showCount: true, showBatch: true, showBarcode: true, showMrp: true, showBrand: true }), [documentPreferences?.item, global_itemPrefs]);
  const countTotal = lines.reduce((sum, line) => sum + (Number(line.count) || 0), 0);
  const activeRates = [...new Set(lines.filter((_, index) => totals.lines[index]?.active).map(({ taxRate }) => taxRate))];
  const termOptions = termDays !== null && !PAYMENT_TERMS.includes(termDays) ? [...PAYMENT_TERMS, termDays].sort((a, b) => a - b) : PAYMENT_TERMS;

  useEffect(() => {
    if (!discountByPercent.current) return;
    const percent = parseFloat(discountPercent) || 0;
    setDiscount(Math.round(discountBase * percent) / 100);
  }, [discountBase, discountPercent]);
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

  async function submit(action: 'SAVE' | InvoiceShareTarget, asDraft=false) {
    if (busyRef.current || disabled) return;
    setError('');
    const enteredLines = [...lines.filter((line) => (line.description || '').trim() || line.itemId || (line.unitPrice ?? 0) !== 0), ...chargeLines];
    if (!partyId) return setError('Select a customer before saving this invoice.');
    if (manualNumberMode && !manualNumber.trim()) return setError('Enter an invoice number.');
    const normalizedPhone = customerPhone.replace(/[\s()-]/g, '');
    if (normalizedPhone && !/^\+?[0-9]{7,15}$/.test(normalizedPhone)) {
      return setError('Enter a valid customer phone number with 7 to 15 digits.');
    }
    if (!invoiceDate || (dueDate && dueDate < invoiceDate)) return setError('Choose an invoice date and a due date on or after it.');
    if (enteredLines.length === chargeLines.length) return setError('Add at least one item with a description.');
    if (
      enteredLines.some(
        (line) =>
          !(line.description || '').trim() ||
          line.description.length > 200 ||
          !Number.isFinite(line.quantity) ||
          line.quantity < 0.001 ||
          !Number.isFinite(line.unitPrice) ||
          line.unitPrice < 0 ||
          !Number.isFinite(line.taxRate) ||
          line.taxRate < 0 ||
          line.taxRate > 100,
      )
    ) {
      return setError('Check each item: enter a description, a positive quantity, a non-negative price, and tax between 0 and 100%.');
    }
    const safeDiscount = (Number.isFinite(discount) ? discount : 0) + adjustmentDiscount;
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
      const { data } = await api.request<Invoice>({method:editingId?'patch':'post',url:editingId?`/invoices/${editingId}`:'/invoices',data:{
        partyId,
        phone:customerPhone,
        ...transactionDetailsPayload(transactionInfo),
        placeOfSupply: placeOfSupply || undefined,
        roundOff: roundOffChoice ?? undefined,
        requestId:saveRequestId.current,
        status: asDraft?'DRAFT':'UNPAID',
        warehouseId: warehouseId || undefined,
        invoiceNumber: manualNumberMode ? manualNumber.trim() : undefined,
        issueDate: invoiceDate,
        dueDate: dueDate || undefined,
        discount: safeDiscount,
        notes: invoiceNotes || undefined,
        deliveryMode: 'MANUAL',
        initialPayment: !asDraft && saleMode === 'CASH' && totals.total > 0 ? { amount: totals.total, method: paymentMethod, requestId:saveRequestId.current } : undefined,
        items: enteredLines.map((line) => ({
          ...trackingFields(line),
          itemId: line.itemId,
          description: (line.description || '').trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          taxInclusive: line.taxInclusive,
          unit: line.unit,
          hsnSac: line.hsnSac,
        })),
      },...requestConfig});
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

      if (action !== 'SAVE') await runInvoiceShare(action, data, enteredLines);
      toast.success(action === 'SAVE' ? 'Invoice saved' : 'Invoice saved and shared', { description: `${data.invoiceNumber} Â· ${formatCurrency(data.grandTotal)}` });
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
      <EditorTabBar label={`${editingId ? 'Edit Sale' : 'Sale'} #${manualNumberMode ? manualNumber || 'â€”' : invoiceNumber}`} newHref="/invoices/new" onClose={onClose} closeDisabled={Boolean(saving)} />

      <header className={styles.header}>
        <div className={styles.headerStart}>
          <h1>{editingId ? 'Edit Sale' : 'Sale'}</h1>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.modeSwitch}>
            <span className={saleMode === 'CREDIT' ? styles.modeActive : ''}>Credit</span>
            <button
              type="button"
              role="switch"
              aria-checked={saleMode === 'CASH'}
              aria-label="Cash sale"
              className={styles.switch}
              disabled={Boolean(saving) || Boolean(savedId)}
              onClick={() => setSaleMode((mode) => (mode === 'CASH' ? 'CREDIT' : 'CASH'))}
            >
              <span />
            </button>
            <span className={saleMode === 'CASH' ? styles.modeActive : ''}>Cash</span>
          </div>
        </div>
        <div className={styles.headerEnd}>
          <GodownPill value={warehouseId} onChange={setWarehouseId} businessId={businessId} />
          <CompanyChip
            businesses={businesses}
            value={businessId}
            disabled={Boolean(saving) || Boolean(savedId) || Boolean(editingId)}
            onChange={(nextId) => {
              setDocumentPreferences(null); setLoading(true); setPartyId(''); setWarehouseId('');
              setBusinessId(nextId);
              setGstRegistered(Boolean(businesses.find(({ id }) => id === nextId)?.gstRegistered));
            }}
          />
        </div>
      </header>

      <main className={styles.scrollArea}>
        {(error || loadError) && (
          <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
            <AlertCircle size={18} />
            <div>
              {error || loadError}
              {loadError && <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>Try again</button>}
              {savedId && (
                <button type="button" onClick={() => router.push(`/invoices/${savedId}?companyId=${encodeURIComponent(businessId)}`)}>
                  Open saved invoice <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <fieldset disabled={disabled} className={styles.form}>
          <legend className="sr-only">Invoice details</legend>

          <section className={styles.partySection}>
            <div className={styles.partyFields}>
              <div className={styles.partyColumn}>
                <label className={`${styles.floating} ${partyId ? '' : styles.floatingFocus}`}>
                  <span>Customer <b>*</b></span>
                  <select value={partyId} onChange={(event) => selectParty(event.target.value)}>
                    <option value="">{loading ? 'Loading customersâ€¦' : ''}</option>
                    {parties.map((party) => <option key={party.id} value={party.id}>{party.name}{party.phone ? ` Â· ${party.phone}` : ''}</option>)}
                  </select>
                  <ChevronDown size={18} aria-hidden="true" />
                </label>
                {selectedParty && (
                  <div className={styles.partyInfo}>
                    <span>Bal: <strong>{formatCurrency(selectedParty.balanceDue ?? 0)}</strong></span>
                    {selectedParty.billingAddr && <p>{selectedParty.billingAddr}</p>}
                  </div>
                )}
                {!loading && !loadError && parties.length === 0 && <p className={styles.help}>Add a customer in Parties before creating an invoice.</p>}
              </div>
              {transactionPrefs.billingName && (
                <input className={styles.input} aria-label="Billing name" placeholder="Billing Name(Optional)" value={transactionInfo.billingName} onChange={(e) => setTransactionInfo({ ...transactionInfo, billingName: e.target.value })} />
              )}
              <div className={styles.partyColumn}>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  aria-label="Phone number"
                  className={styles.input}
                  value={customerPhone}
                  placeholder="Phone No."
                  onChange={(event) => setCustomerPhone(event.target.value.replace(/[^0-9+ ()-]/g, ''))}
                />
                {transactionPrefs.eWayBill && (
                  <input className={styles.input} aria-label="E-Way Bill No." placeholder="E-Way Bill No." value={transactionInfo.eWayBillNumber} onChange={(e) => setTransactionInfo({ ...transactionInfo, eWayBillNumber: e.target.value })} />
                )}
              </div>
            </div>

            <div className={styles.meta}>
              <MetaRow label="Invoice Number">
                {manualNumberMode ? (
                  <input aria-label="Invoice number" value={manualNumber} maxLength={40} placeholder="Enter number *" onChange={(event) => setManualNumber(event.target.value)} />
                ) : (
                  <output aria-label="Invoice number">{invoiceNumber}</output>
                )}
              </MetaRow>
              <MetaRow label="Invoice Date">
                <input type="date" required aria-label="Invoice date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
                <CalendarDays size={16} aria-hidden="true" />
              </MetaRow>
              <MetaRow label="Payment Terms">
                <select
                  aria-label="Payment terms"
                  value={termDays ?? 'custom'}
                  onChange={(event) => {
                    termTouched.current = true;
                    setTermDays(event.target.value === 'custom' ? null : Number(event.target.value));
                  }}
                >
                  {termOptions.map((days) => <option key={days} value={days}>{days === 0 ? 'Due on Receipt' : `Net ${days}`}</option>)}
                  <option value="custom">Custom</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </MetaRow>
              <MetaRow label="Due Date">
                <input
                  type="date"
                  aria-label="Due date"
                  min={invoiceDate}
                  value={dueDate}
                  onChange={(event) => { termTouched.current = true; setTermDays(null); setDueDate(event.target.value); }}
                />
                <CalendarDays size={16} aria-hidden="true" />
              </MetaRow>
              <MetaRow label="State of supply">
                <select aria-label="State of supply" value={placeOfSupply} onChange={(event) => setPlaceOfSupply(event.target.value)} className={placeOfSupply ? '' : styles.placeholder}>
                  <option value="">Select</option>
                  {[...new Set([...SUPPLY_STATES, placeOfSupply].filter(Boolean))].map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </MetaRow>
              {saleMode === 'CASH' && (
                <MetaRow label="Payment Type">
                  <select aria-label="Payment type" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </MetaRow>
              )}
            </div>
          </section>

          <section className={styles.itemsSection}>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Invoice items; scroll horizontally to view all columns">
              <table className={styles.table}>
                <caption className="sr-only">Invoice items, quantities, prices, taxes and amounts</caption>
                <thead>
                  <tr>
                    <th scope="col" className={styles.numberCol}>#</th>
                    <th scope="col" className={styles.itemCol}>Item</th>
                    <TrackingHeaders preferences={trackingColumns} />
                    <th scope="col">Qty</th>
                    <th scope="col">Unit</th>
                    <th scope="col" className={styles.right}>Price/Unit</th>
                    <th scope="col" className={styles.right}>Amount</th>
                    <th scope="col" className={styles.addCol}>
                      <button type="button" aria-label="Add row" disabled={lines.length >= 200} onClick={() => setLines((current) => [...current, newLine()])}><PlusCircle size={18} /></button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.key}>
                      <td className={styles.numberCell}>
                        <span>{index + 1}</span>
                        <button
                          type="button"
                          aria-label={`Remove item ${index + 1}`}
                          onClick={() => setLines((current) => (current.length === 1 ? [emptyLine()] : current.filter(({ key }) => key !== line.key)))}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                      <td>
                        <input
                          aria-label={`Item ${index + 1}`}
                          list="invoice-catalog"
                          className={styles.cellInput}
                          maxLength={200}
                          value={line.description}
                          onChange={(event) => typeItem(line, event.target.value)}
                        />
                      </td>
                      <TrackingCells preferences={trackingColumns} line={line} index={index} onChange={(patch) => updateLine(line.key, patch)} />
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
                      </td>
                      <td>
                        <select aria-label={`Unit ${index + 1}`} className={styles.cellInput} value={line.unit ?? ''} onChange={(e) => updateLine(line.key, { unit: e.target.value })}>
                          <option value="">NONE</option>
                          {[...new Set(['pcs', 'kg', 'm', 'box', 'set', line.unit ?? ''])].filter(Boolean).map((u) => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Rate ${index + 1}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className={`${styles.cellInput} ${styles.right}`}
                          value={isNaN(line.unitPrice) ? '' : line.unitPrice}
                          readOnly={!transactionPrefs.editPriceOnInvoice && Boolean(line.itemId)}
                          title={!transactionPrefs.editPriceOnInvoice && line.itemId ? 'Price editing is turned off in Transaction settings' : undefined}
                          onChange={(event) => updateLine(line.key, { unitPrice: parseFloat(event.target.value) || 0 })}
                        />
                      </td>
                      <td className={styles.amount}>{totals.lines[index]?.active ? formatCurrency(totals.lines[index].total) : ''}</td>
                      <td aria-hidden="true" />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td>
                      <div className={styles.totalLabel}>
                        <button type="button" className={styles.addRow} disabled={lines.length >= 200} onClick={() => setLines((current) => [...current, newLine()])}>ADD ROW</button>
                        <span>TOTAL</span>
                      </div>
                    </td>
                    <TrackingBlanks preferences={trackingColumns} values={{ count: countTotal }} />
                    <td className={styles.right}>{itemTotals.quantity}</td>
                    <td />
                    <td />
                    <td className={styles.right}>{formatCurrency(itemTotals.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <datalist id="invoice-catalog">
                {catalog.map((item) => <option key={item.id} value={item.name} />)}
              </datalist>
            </div>
          </section>

          <section className={styles.bottomSection}>
            <div className={styles.logistics}>
              <TransactionDetailsFields value={transactionInfo} onChange={setTransactionInfo} />
              {showTerms ? (
                <label className={styles.noteField}>
                  <span>Terms &amp; Conditions</span>
                  <textarea rows={3} maxLength={5000} placeholder="Payment terms, delivery informationâ€¦" value={terms} onChange={(event) => setTerms(event.target.value)} autoFocus />
                </label>
              ) : (
                <button type="button" className={styles.termsButton} onClick={() => setShowTerms(true)}><ListChecks size={18} /> ADD TERMS &amp; CONDITIONS</button>
              )}
            </div>

            <div className={styles.extras}>
              {showDescription ? (
                <label className={styles.noteField}>
                  <span>Description</span>
                  <textarea rows={3} maxLength={5000} placeholder="Add a message or reference for this invoiceâ€¦" value={notes} onChange={(event) => setNotes(event.target.value)} autoFocus={!notes} />
                </label>
              ) : (
                <button type="button" className={styles.extraButton} onClick={() => setShowDescription(true)}><FileText size={17} /> ADD DESCRIPTION</button>
              )}
              <input ref={imageInputRef} className={styles.hiddenFileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => addAttachments(event, 'image')} />
              <input ref={documentInputRef} className={styles.hiddenFileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple onChange={(event) => addAttachments(event, 'document')} />
              <button type="button" className={styles.extraButton} onClick={() => imageInputRef.current?.click()}><Camera size={17} /> ADD IMAGE</button>
              <button type="button" className={styles.extraButton} onClick={() => documentInputRef.current?.click()}><FilePlus2 size={17} /> ADD DOCUMENT</button>
              {attachments.length > 0 && (
                <div className={styles.attachmentList} aria-label="Selected attachments">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className={styles.attachmentChip}>
                      {attachment.previewUrl ? <Image src={attachment.previewUrl} width={32} height={32} unoptimized alt="" /> : <span className={styles.documentIcon}><FileCheck2 size={16} /></span>}
                      <span>
                        <strong>{attachment.file.name}</strong>
                        <small>{(attachment.file.size / 1024 / 1024).toFixed(1)} MB</small>
                      </span>
                      <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.file.name}`}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.totals} aria-label="Invoice totals">
              <div className={styles.totalsRow}>
                <span>Discount</span>
                <div className={styles.discountInputs}>
                  <label className={styles.suffixInput}>
                    <input
                      aria-label="Discount percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountPercent}
                      onChange={(event) => { discountByPercent.current = true; setDiscountPercent(event.target.value); }}
                    />
                    <small>(%)</small>
                  </label>
                  <span aria-hidden="true">-</span>
                  <label className={styles.suffixInput}>
                    <input
                      aria-label="Discount amount"
                      type="number"
                      min="0"
                      step="0.01"
                      max={discountBase}
                      value={discount ? discount : ''}
                      onChange={(event) => {
                        const amount = parseFloat(event.target.value) || 0;
                        discountByPercent.current = false;
                        setDiscount(amount);
                        setDiscountPercent(amount && discountBase ? String(Math.round((amount / discountBase) * 10000) / 100) : '');
                      }}
                    />
                    <small>(â‚¹)</small>
                  </label>
                </div>
              </div>
              <div className={styles.totalsRow}>
                <span>Tax</span>
                <select
                  aria-label="Tax for all items"
                  disabled={!showTax}
                  value={!showTax ? '' : activeRates.length === 1 ? String(activeRates[0]) : activeRates.length === 0 && taxChoice !== null ? String(taxChoice) : ''}
                  onChange={(event) => { const rate = Number(event.target.value); setTaxChoice(rate); setLines((current) => current.map((line) => ({ ...line, taxRate: rate }))); }}
                >
                  {(!showTax || activeRates.length !== 1) && <option value="">{!showTax ? 'None' : activeRates.length > 1 ? 'Mixed' : 'Select'}</option>}
                  {GST_RATES.map((rate) => <option key={rate} value={rate}>{rate === 0 ? 'None' : `GST@${rate}%`}</option>)}
                </select>
                <output>{formatCurrency(totals.tax)}</output>
              </div>
              {!showTax && !loading && (
                <p className={styles.taxHint}>
                  {totalOptions.noTax ? 'Composition scheme is on, so sales carry no tax.' : 'This company is not GST-registered. Turn on GST registration in company settings to charge tax.'}
                </p>
              )}
              {CHARGES.map(([key, label]) => (
                <div key={key} className={styles.totalsRow}>
                  <span>{label}</span>
                  <input
                    aria-label={`${label} amount`}
                    type="number"
                    min={key === 'adjustment' ? undefined : 0}
                    step="0.01"
                    value={charges[key]}
                    onChange={(event) => setCharges((current) => ({ ...current, [key]: event.target.value }))}
                  />
                  <output>{formatCurrency(Number(charges[key]) || 0)}</output>
                </div>
              ))}
              <div className={styles.grandTotal}>
                <label className={styles.roundOff}>
                  <input type="checkbox" checked={roundOff} onChange={(event) => setRoundOffChoice(event.target.checked)} />
                  <span>Round Off</span>
                </label>
                <output className={styles.roundOffValue} aria-label="Round off amount">{totals.roundOff ? Number(totals.roundOff).toFixed(2) : ''}</output>
                <span>Total</span>
                <output className={styles.totalValue} aria-live="polite">{formatCurrency(totals.total)}</output>
              </div>
              <div className={styles.balanceRow}>
                <span>{saleMode === 'CASH' ? 'Received' : 'Balance Due'}</span>
                <strong>{formatCurrency(totals.total)}</strong>
              </div>
            </div>
          </section>
        </fieldset>
      </main>

      <footer className={styles.footer}>
        <button type="button" className={styles.trendButton} onClick={() => window.open('/reports', '_blank', 'noopener')} aria-label="Open sales reports in a new tab" title="Sales reports">
          <TrendingUp size={18} />
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
            <span>{saving.startsWith('SHARE_') && <Loader2 size={16} className="animate-spin" />}Share</span>
            <ChevronDown size={16} />
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
        <button type="button" disabled={disabled || Boolean(editingId && !sourceDraft)} onClick={() => void submit('SAVE', true)} className={styles.secondaryButton}>Save Draft</button>
        <button type="button" disabled={disabled} onClick={() => void submit('SAVE')} className={styles.saveButton}>
          {saving === 'SAVE' && <Loader2 size={17} className="animate-spin" />}
          <span>{saving === 'SAVE' ? 'Savingâ€¦' : 'Save'}</span>
        </button>
      </footer>
    </div>
  );
}
