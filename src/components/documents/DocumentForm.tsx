'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  File as FileIcon,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  Plus,
  RotateCcw,
  Send,
  Save,
  Share2,
  ShoppingBag,
  Trash2,
  Truck,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import Modal from '@/components/Modal';
import { api, getActiveBusinessId, getAllPages, getApiError } from '@/lib/api';
import { DOCUMENT_CONFIG, DOCUMENT_TYPES, type DocumentConfig } from '@/lib/documents';
import { formatCurrency } from '@/lib/format';
import { prepareUploads } from '@/lib/imageCompression';
import type { Business, BusinessDocument, BusinessDocumentType, Invoice, Item, Party, Supplier } from '@/types';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';
import DocumentCompanyPicker from '@/components/DocumentCompanyPicker';
import { calculateDocument, type DocumentDraftLine } from './documentTotals';
import { totalsOptionsFor } from '../invoices/invoiceTotals';
import { usePreferences } from '@/lib/useGeneralPreferences';
import { renderMessage, whatsappLink } from '@/lib/messageTemplates';
import styles from './DocumentForm.module.css';

const generateLineId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback
    }
  }
  return 'doc_line_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
};

const emptyLine = (): DocumentDraftLine => ({
  key: generateLineId(),
  description: '',
  hsnSac: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 0,
  taxRate: 0,
});

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const PURCHASE_UNIT_OPTIONS = ['pcs', 'nos', 'kg', 'g', 'ltr', 'ml', 'm', 'cm', 'box', 'set', 'pair', 'hr', 'day'];
const PURCHASE_TAX_OPTIONS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];
const PLACE_OF_SUPPLY_OPTIONS = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
];

function optionsWithCurrent(options: Array<string | number>, current: string | number) {
  return current === '' || options.some((option) => String(option).toLowerCase() === String(current).toLowerCase())
    ? options
    : [...options, current];
}

type PurchaseAttachment = {
  id: string;
  file: File;
  category: 'bill' | 'image' | 'document';
  previewUrl?: string;
};

type DocumentShareTarget = 'pdf' | 'document' | 'excel' | 'whatsapp' | 'email';

function escapeMarkup(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TYPE_ICONS: Record<BusinessDocumentType, typeof FileText> = {
  QUOTATION: FileText,
  PROFORMA_INVOICE: FileSpreadsheet,
  PURCHASE_INVOICE: ShoppingBag,
  DELIVERY_CHALLAN: Truck,
  CREDIT_NOTE: RotateCcw,
  DEBIT_NOTE: CreditCard,
};

type DocumentFormProps = {
  type?: BusinessDocumentType;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
  allowTypeSwitch?: boolean;
  onTypeChange?: (type: BusinessDocumentType) => void;
};

export default function DocumentForm({
  type: initialType = 'QUOTATION',
  onClose,
  onBusyChange,
  allowTypeSwitch = false,
  onTypeChange,
}: DocumentFormProps) {
  const router = useRouter();
  const { initialPartyId = '', initialType: embeddedType } = useEmbeddedForm();
  const [docType, setDocType] = useState<BusinessDocumentType>(embeddedType ?? initialType);

  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<BusinessDocument[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState(() => getActiveBusinessId() ?? '');
  const [gstRegistered, setGstRegistered] = useState(true);

  const [partyId, setPartyId] = useState('');
  const [referenceInvoiceId, setReferenceInvoiceId] = useState('');
  const [sourceDocumentId, setSourceDocumentId] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [transportName, setTransportName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [eWayBillNumber, setEWayBillNumber] = useState('');
  const [reason, setReason] = useState('');
  const [terms, setTerms] = useState('Prices and taxes are subject to the terms agreed with the party.');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DocumentDraftLine[]>(() => [emptyLine()]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [attachments, setAttachments] = useState<PurchaseAttachment[]>([]);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const transactionPrefs = usePreferences('transaction');
  const taxPrefs = usePreferences('taxes');
  const messagePrefs = usePreferences('message');
  const busyRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const billInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<PurchaseAttachment[]>([]);

  const isPurchase = docType === 'PURCHASE_INVOICE';
  const isDebitNote = docType === 'DEBIT_NOTE';
  const isSupplierDocument = isPurchase || isDebitNote;
  const isAdjustment = docType === 'CREDIT_NOTE' || docType === 'DEBIT_NOTE';
  const isChallan = docType === 'DELIVERY_CHALLAN';
  const config: DocumentConfig = DOCUMENT_CONFIG[docType];
  const documentTitle = isPurchase ? 'Purchase Bill' : config.label;
  const partyLabel = isSupplierDocument ? 'Supplier' : 'Customer';
  const IconComponent = TYPE_ICONS[docType] || FileText;
  const availableParties = isSupplierDocument ? suppliers : parties;

  const setBusy = useCallback(
    (busy: boolean) => {
      busyRef.current = busy;
      onBusyChange?.(busy);
    },
    [onBusyChange],
  );

  const switchType = (newType: BusinessDocumentType) => {
    setDocType(newType);
    setPartyId('');
    setReferenceInvoiceId('');
    setSourceDocumentId('');
    setReason('');
    onTypeChange?.(newType);
  };

  const loadData = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setLoadError('');
      try {
        const companyConfig = { signal, headers: businessId ? { 'X-Business-Id': businessId } : undefined };
        const [partyRes, supplierRes, itemRes, invoiceRes, purchaseBillRes, businessRes] = await Promise.all([
          getAllPages<Party>('/parties', companyConfig),
          getAllPages<Supplier>('/suppliers', companyConfig),
          getAllPages<Item>('/items', companyConfig),
          getAllPages<Invoice>('/invoices', companyConfig),
          getAllPages<BusinessDocument>('/documents', { ...companyConfig, params: { type: 'PURCHASE_INVOICE' } }),
          getAllPages<Business>('/businesses', { signal }),
        ]);
        if (signal.aborted) return;

        setParties(partyRes.data || []);
        setSuppliers(supplierRes.data || []);
        setCatalog(itemRes.data || []);
        setInvoices(invoiceRes.data || []);
        setPurchaseBills(purchaseBillRes.data || []);
        setBusinesses(businessRes.data || []);

        const selectedId = businessId || getActiveBusinessId() || businessRes.data?.[0]?.id || '';
        const business = (businessRes.data || []).find(({ id }) => id === selectedId) ?? businessRes.data?.[0];
        if (business) {
          setBusinessId(business.id);
          setGstRegistered(Boolean(business.gstRegistered));
        }

        const queryPartyId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('partyId') : null;
        const requestedParty = initialPartyId || queryPartyId || '';
        if (requestedParty) {
          if (isSupplierDocument && supplierRes.data.some(({ id }) => id === requestedParty)) {
            setPartyId(requestedParty);
          } else if (!isSupplierDocument && partyRes.data.some(({ id }) => id === requestedParty)) {
            setPartyId(requestedParty);
          }
        }
      } catch (loadFailure) {
        if (!signal.aborted) {
          setLoadError(getApiError(loadFailure, `Could not load ${config.label.toLowerCase()} details. Please try again.`));
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [businessId, config.label, initialPartyId, isSupplierDocument],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, loadVersion]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach(({ previewUrl }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
  }, []);

  function updateLine(key: string, patch: Partial<DocumentDraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function pickItem(key: string, itemId: string) {
    const item = catalog.find(({ id }) => id === itemId);
    if (!item) {
      updateLine(key, { itemId: undefined });
      return;
    }
    const itemPrice = Number(item.salePrice);
    const itemTaxRate = Number(item.taxRate);
    updateLine(key, {
      itemId: item.id,
      description: item.name,
      hsnSac: '',
      unit: item.unit || 'pcs',
      unitPrice: Number.isFinite(itemPrice) ? itemPrice : 0,
      taxRate: isSupplierDocument || gstRegistered ? (Number.isFinite(itemTaxRate) ? itemTaxRate : 0) : 0,
    });
  }

  async function pickReferenceInvoice(invoiceId: string) {
    setReferenceInvoiceId(invoiceId);
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    if (invoice?.party?.id) setPartyId(invoice.party.id);
    if (!invoiceId) return;

    try {
      const { data } = await api.get<Invoice>(`/invoices/${invoiceId}`);
      if (data.items?.length) {
        setLines(
          data.items.map((item) => ({
            key: generateLineId(),
            itemId: item.itemId,
            description: item.description,
            hsnSac: '',
            quantity: Number(item.quantity) || 1,
            unit: 'pcs',
            unitPrice: Number(item.unitPrice) || 0,
            taxRate: Number(item.taxRate) || 0,
          })),
        );
      }
    } catch {
      // Keep reference even if line items cannot be prefilled
    }
  }

  async function pickReferencePurchaseBill(documentId: string) {
    setSourceDocumentId(documentId);
    const purchaseBill = purchaseBills.find((entry) => entry.id === documentId);
    if (purchaseBill?.supplierId) setPartyId(purchaseBill.supplierId);
    if (!documentId) return;

    try {
      const { data } = await api.get<BusinessDocument>(`/documents/${documentId}`);
      if (data.supplierId) setPartyId(data.supplierId);
      if (data.items?.length) {
        setLines(data.items.map((item) => ({
          key: generateLineId(), itemId: item.itemId, description: item.description,
          hsnSac: item.hsnSac || '', quantity: Number(item.quantity) || 1,
          unit: item.unit || 'pcs', unitPrice: Number(item.unitPrice) || 0,
          taxRate: Number(item.taxRate) || 0,
        })));
      }
    } catch {
      // Keep the reference even if the source lines cannot be prefilled.
    }
  }

  function addPurchaseAttachments(event: ChangeEvent<HTMLInputElement>, category: PurchaseAttachment['category']) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    const availableSlots = Math.max(0, 10 - attachments.length);
    let availableBytes = Math.max(0, 25 * 1024 * 1024 - attachments.reduce((sum, entry) => sum + entry.file.size, 0));
    const accepted = selected.filter((file) => {
      if (file.size <= 0 || file.size > 10 * 1024 * 1024 || file.size > availableBytes) return false;
      availableBytes -= file.size;
      return true;
    }).slice(0, availableSlots);

    if (accepted.length !== selected.length) {
      setError('You can upload up to 10 files and 25 MB total. Each file must be 10 MB or smaller.');
    }

    setAttachments((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: generateLineId(),
        file,
        category,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      })),
    ]);
  }

  function removePurchaseAttachment(id: string) {
    setAttachments((current) => {
      const attachment = current.find((entry) => entry.id === id);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }

  function documentExportMarkup(document: BusinessDocument) {
    const rows = lines
      .filter((line) => (line.description || '').trim() || line.itemId || line.unitPrice !== 0)
      .map((line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeMarkup(line.description)}</td>
          <td>${escapeMarkup(line.quantity)}</td>
          <td>${escapeMarkup(line.unit)}</td>
          <td>${escapeMarkup(line.unitPrice)}</td>
          <td>${escapeMarkup(line.taxRate)}%</td>
          <td>${escapeMarkup(calculateDocument([line], 0, true, { noTax: totalOptions.noTax }).total)}</td>
        </tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#172033}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3dc;padding:8px;text-align:left}th{background:#eef3f8}.total{text-align:right;font-size:18px;font-weight:700;margin-top:16px}</style></head><body><h1>${escapeMarkup(documentTitle)}</h1><p><strong>${escapeMarkup(config.shortLabel)}:</strong> ${escapeMarkup(referenceNumber || document.documentNumber)}</p><p><strong>${escapeMarkup(partyLabel)}:</strong> ${escapeMarkup(selectedParty?.name || '')}</p><p><strong>Date:</strong> ${escapeMarkup(issueDate)}</p><table><thead><tr><th>#</th><th>Item details</th><th>Qty</th><th>Unit</th><th>Price / unit</th><th>Tax</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total: ${escapeMarkup(totals.total)}</p></body></html>`;
  }

  async function runDocumentShare(target: DocumentShareTarget, document: BusinessDocument) {
    const fileBase = referenceNumber.trim() || document.documentNumber || config.label.toLowerCase().replaceAll(' ', '-');
    if (target === 'pdf') {
      const { data } = await api.get<Blob>(`/documents/${document.id}/pdf`, { responseType: 'blob' });
      downloadFile(new Blob([data], { type: 'application/pdf' }), `${fileBase}.pdf`);
      return;
    }

    if (target === 'document') {
      downloadFile(new Blob([documentExportMarkup(document)], { type: 'application/msword;charset=utf-8' }), `${fileBase}.doc`);
      return;
    }

    if (target === 'excel') {
      downloadFile(new Blob([documentExportMarkup(document)], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${fileBase}.xls`);
      return;
    }

    const documentNumberText = referenceNumber || document.documentNumber;
    const template = docType === 'QUOTATION' || docType === 'PROFORMA_INVOICE' ? messagePrefs.estimateMessage : messagePrefs.invoiceMessage;
    const message = isSupplierDocument
      ? `${documentTitle} ${documentNumberText}\n${partyLabel}: ${selectedParty?.name || ''}\nTotal: ${formatCurrency(totals.total)}`
      : renderMessage(template, {
          FirmName: businesses.find(({ id }) => id === businessId)?.name ?? '',
          PartyName: selectedParty?.name ?? '',
          InvoiceNumber: documentNumberText,
          EstimateNumber: documentNumberText,
          Amount: formatCurrency(totals.total),
        });
    if (target === 'whatsapp') {
      window.open(whatsappLink(selectedParty?.phone, message), '_blank', 'noopener,noreferrer');
      return;
    }

    const recipient = selectedParty?.email || '';
    window.open(`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`${documentTitle} ${referenceNumber || document.documentNumber}`)}&body=${encodeURIComponent(message)}`, '_blank');
  }

  const totalOptions = useMemo(() => totalsOptionsFor(transactionPrefs, taxPrefs, !isSupplierDocument), [transactionPrefs, taxPrefs, isSupplierDocument]);
  const totals = useMemo(() => calculateDocument(lines, discount, isSupplierDocument || gstRegistered, totalOptions), [discount, gstRegistered, isSupplierDocument, lines, totalOptions]);
  const selectedParty = availableParties.find(({ id }) => id === partyId);
  const disabled = loading || Boolean(loadError) || Boolean(saving) || Boolean(savedId);

  async function submit(status: 'DRAFT' | 'ISSUED', shareTarget?: DocumentShareTarget) {
    if (busyRef.current || disabled) return;
    setError('');

    const targetPartyLabel = isSupplierDocument ? 'supplier' : 'party';
    if (!partyId) return setError(`Select a ${targetPartyLabel} before saving this ${config.label.toLowerCase()}.`);
    if (docType === 'CREDIT_NOTE' && !referenceInvoiceId) return setError('Select the sale invoice this credit note adjusts.');
    if (isDebitNote && !sourceDocumentId) return setError('Select the purchase bill this debit note adjusts.');
    if (!issueDate) return setError('Choose an issue date.');
    if (validUntil && validUntil < issueDate) return setError('Validity date must be on or after the issue date.');
    if (dueDate && dueDate < issueDate) return setError('Due date must be on or after the issue date.');

    const normalizedLines = lines.map((line) => {
      const catalogItem = line.itemId ? catalog.find((item) => item.id === line.itemId) : undefined;
      return {
        ...line,
        description: (line.description || catalogItem?.name || '').trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        taxRate: Number(line.taxRate),
      };
    });
    const enteredLines = normalizedLines.filter((line) => line.description || line.itemId || line.unitPrice !== 0);
    if (!enteredLines.length) return setError('Add at least one item with a description.');

    for (const line of enteredLines) {
      const rowNumber = normalizedLines.findIndex(({ key }) => key === line.key) + 1;
      if (!line.description) return setError(`Row ${rowNumber}: enter an item description.`);
      if (line.description.length > 200) return setError(`Row ${rowNumber}: description must be 200 characters or fewer.`);
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) return setError(`Row ${rowNumber}: quantity must be greater than zero.`);
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) return setError(`Row ${rowNumber}: enter a valid price of zero or more.`);
      if (!Number.isFinite(line.taxRate) || line.taxRate < 0 || line.taxRate > 100) {
        return setError(`Row ${rowNumber}: select a tax rate between 0% and 100%.`);
      }
    }

    const safeDiscount = Number.isFinite(discount) ? discount : 0;
    if (safeDiscount < 0 || safeDiscount > totals.subtotal + totals.tax) {
      return setError('Discount cannot exceed the total document value.');
    }

    setBusy(true);
    setSaving(shareTarget ? `SHARE_${shareTarget}` : status);
    let createdId = '';

    try {
      const payload = {
        type: docType,
        status,
        partyId: isSupplierDocument ? undefined : partyId,
        supplierId: isSupplierDocument ? partyId : undefined,
        referenceInvoiceId: docType === 'CREDIT_NOTE' ? referenceInvoiceId : undefined,
        sourceDocumentId: isDebitNote ? sourceDocumentId : undefined,
        issueDate,
        validUntil: validUntil || undefined,
        dueDate: dueDate || undefined,
        discount: safeDiscount,
        referenceNumber: referenceNumber.trim() || undefined,
        placeOfSupply: placeOfSupply.trim() || undefined,
        transportName: isChallan ? transportName.trim() || undefined : undefined,
        vehicleNumber: isChallan ? vehicleNumber.trim().toUpperCase() || undefined : undefined,
        eWayBillNumber: isChallan ? eWayBillNumber.trim() || undefined : undefined,
        reason: isAdjustment ? reason.trim() || undefined : undefined,
        terms: terms.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: isPurchase ? paymentMethod : undefined,
        items: enteredLines.map((line) => ({
          itemId: line.itemId,
          description: (line.description || '').trim(),
          hsnSac: isSupplierDocument ? undefined : (line.hsnSac || '').trim() || undefined,
          quantity: line.quantity,
          unit: line.unit || 'pcs',
          unitPrice: line.unitPrice,
          taxRate: isSupplierDocument || gstRegistered ? line.taxRate : 0,
        })),
      };

      const { data } = await api.post<BusinessDocument>('/documents', payload, {
        headers: { 'X-Business-Id': businessId },
      });
      createdId = data.id;
      setSavedId(data.id);
      if (isPurchase && attachments.length) {
        const formData = new FormData();
        (await prepareUploads(attachments.map(({ file }) => file))).forEach((file) => formData.append('files', file, file.name));
        await api.post(`/documents/${data.id}/attachments`, formData, {
          headers: { 'X-Business-Id': businessId, 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
      }
      if (shareTarget) await runDocumentShare(shareTarget, data);
      router.push(`/documents/${data.id}?companyId=${encodeURIComponent(businessId)}${!shareTarget && status === 'ISSUED' && messagePrefs.autoShareOnSave && !isSupplierDocument ? '&share=whatsapp' : ''}`);
    } catch (saveError: unknown) {
      setError(
        createdId
          ? `${config.label} saved, but an upload or sharing step could not be completed. Open the saved ${config.label.toLowerCase()} to review it.`
          : getApiError(saveError, `Could not save ${config.label.toLowerCase()}. Your details are still here.`),
      );
    } finally {
      setBusy(false);
      setSaving('');
    }
  }

  return (
    <div className={`${styles.editor} ${isPurchase ? styles.purchaseEditor : ''}`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={Boolean(saving)} aria-label="Close document">
            <ArrowLeft size={20} />
          </button>
          <span className={styles.headerIcon}>
            <IconComponent size={22} />
          </span>
          <div>
            <div className={styles.titleRow}>
              <h1>{isPurchase ? 'New Purchase Bill' : `New ${config.label.toLowerCase()}`}</h1>
              <span className={styles.draft}>{savedId ? 'Saved' : 'Draft'}</span>
            </div>
            <p>{config.description}</p>
          </div>
        </div>

        <div className={styles.headerEnd}>
          <DocumentCompanyPicker
            businesses={businesses}
            value={businessId}
            disabled={Boolean(saving) || Boolean(savedId)}
            onChange={(nextId) => {
              setBusinessId(nextId);
              setGstRegistered(Boolean(businesses.find(({ id }) => id === nextId)?.gstRegistered));
            }}
          />
          <span className={styles.documentNumber}>Auto-assigned</span>
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={Boolean(saving)} aria-label="Close document editor">
            <X size={20} />
          </button>
        </div>
      </header>

      <main className={styles.scrollArea}>
        <div className={styles.workspace}>
          <div className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>{isPurchase ? 'PURCHASES / CREATE BILL' : `${config.plural.toUpperCase()} / CREATE ${config.label.toUpperCase()}`}</span>
              <h2>{isPurchase ? 'Let’s get the details right.' : `Let’s set up your ${config.label.toLowerCase()}.`}</h2>
              <p>{isPurchase ? 'Add your supplier and items. We’ll calculate the rest.' : 'Add party details, line items, and terms. We’ll calculate totals automatically.'}</p>
            </div>
            {allowTypeSwitch && (
              <div className={styles.typeTabs} role="tablist" aria-label="Document types">
                {DOCUMENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={docType === t}
                    className={`${styles.typeTab} ${docType === t ? styles.typeTabActive : ''}`}
                    onClick={() => switchType(t)}
                  >
                    {DOCUMENT_CONFIG[t].shortLabel}
                  </button>
                ))}
              </div>
            )}
            <span className={styles.requiredNote}>* Required fields</span>
          </div>

          {(error || loadError) && (
            <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
              <AlertCircle size={18} />
              <div>
                {error || loadError}
                {loadError && (
                  <button type="button" onClick={() => setLoadVersion((v) => v + 1)}>
                    Try again
                  </button>
                )}
                {savedId && (
                  <button type="button" onClick={() => router.push(`/documents/${savedId}?companyId=${encodeURIComponent(businessId)}`)}>
                    Open saved document <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          <fieldset disabled={disabled} className={`${styles.formLayout} ${isPurchase ? styles.purchaseLayout : ''}`}>
            <legend className="sr-only">{config.label} details</legend>

            <div className={styles.primaryColumn}>
              <section className={styles.card}>
                <SectionHeading
                  icon={<UserRound size={18} />}
                  title={isSupplierDocument ? 'Supplier details' : 'Party / Customer details'}
                  description={isSupplierDocument ? 'Who supplied the materials or services?' : 'Who is this document addressed to?'}
                  trailing={
                    isSupplierDocument && (
                      <button type="button" onClick={() => setShowSupplierModal(true)} className={styles.quickAddBtn}>
                        <Plus size={13} /> Add supplier
                      </button>
                    )
                  }
                />
                <div className={styles.cardBody}>
                  <div className={isSupplierDocument ? styles.purchaseSupplierFields : undefined}>
                    <Field label={`${isSupplierDocument ? 'Supplier' : 'Customer'} *`}>
                      <select
                        className={styles.input}
                        value={partyId}
                        disabled={(docType === 'CREDIT_NOTE' && Boolean(referenceInvoiceId)) || (isDebitNote && Boolean(sourceDocumentId))}
                        onChange={(e) => setPartyId(e.target.value)}
                      >
                        <option value="">{loading ? 'Loading...' : `Search by ${isSupplierDocument ? 'name / phone' : 'customer'}`}</option>
                        {availableParties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.phone ? ` · ${p.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {isSupplierDocument && (
                      <Field label="Phone number">
                        <input
                          className={`${styles.input} ${styles.phoneReadonly}`}
                          value={selectedParty?.phone || ''}
                          placeholder="Phone No."
                          readOnly
                        />
                      </Field>
                    )}
                  </div>

                  {selectedParty ? (
                    <div className={styles.customerDetails}>
                      <div className={styles.customerIdentity}>
                        <span className={styles.avatar}>{(selectedParty.name || 'P').slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{selectedParty.name}</strong>
                          <p>{selectedParty.phone || selectedParty.email || 'No contact details saved'}</p>
                        </div>
                        <span className={styles.balance}>
                          {'balanceDue' in selectedParty && (
                            <>
                              Balance due
                              <strong>{formatCurrency(selectedParty.balanceDue ?? 0)}</strong>
                            </>
                          )}
                        </span>
                      </div>
                      <div className={styles.addressGrid}>
                        <div>
                          <span>Billing address</span>
                          <p>{(isSupplierDocument ? (selectedParty as Supplier).address : (selectedParty as Party).billingAddr) || 'No billing address added'}</p>
                        </div>
                        <div>
                          <span>Shipping address</span>
                          <p>{(isSupplierDocument ? (selectedParty as Supplier).address : (selectedParty as Party).shippingAddr || (selectedParty as Party).billingAddr) || 'Same as billing address'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.customerPlaceholder}>
                      <UserRound size={18} />
                      <p>Select a {isSupplierDocument ? 'supplier' : 'customer'} to see contact information and addresses.</p>
                    </div>
                  )}
                </div>
              </section>

              {isAdjustment && (
                <section className={styles.card}>
                  <SectionHeading icon={<RotateCcw size={18} />} title="Adjustment context" description={isDebitNote ? 'Link to the original purchase bill and state the adjustment reason' : 'Link to the original sale invoice and state the adjustment reason'} />
                  <div className={`${styles.cardBody} ${styles.extraGrid}`}>
                    {isDebitNote ? (
                      <Field label="Original purchase bill *">
                        <select className={styles.input} value={sourceDocumentId} onChange={(e) => void pickReferencePurchaseBill(e.target.value)}>
                          <option value="">Select purchase bill to adjust</option>
                          {purchaseBills.map((bill) => (
                            <option key={bill.id} value={bill.id}>
                              {bill.documentNumber} · {bill.supplier?.name || 'Supplier'} · {formatCurrency(bill.grandTotal)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <Field label="Original sale invoice *">
                        <select className={styles.input} value={referenceInvoiceId} onChange={(e) => void pickReferenceInvoice(e.target.value)}>
                          <option value="">Select sale invoice to adjust</option>
                          {invoices.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoiceNumber} · {inv.party?.name} · {formatCurrency(inv.grandTotal)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <div className="sm:col-span-2">
                      <Field label="Reason for adjustment *">
                        <input
                          className={styles.input}
                          required
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Goods return, rate discrepancy, discount difference, or error correction..."
                        />
                      </Field>
                    </div>
                  </div>
                </section>
              )}

              {isChallan && (
                <section className={styles.card}>
                  <SectionHeading icon={<Truck size={18} />} title="Transport & dispatch" description="Dispatch details for goods movement" />
                  <div className={`${styles.cardBody} ${styles.extraGrid}`}>
                    <Field label="Transport / Courier">
                      <input className={styles.input} value={transportName} onChange={(e) => setTransportName(e.target.value)} placeholder="Courier or carrier name" />
                    </Field>
                    <Field label="Vehicle number">
                      <input className={styles.input} value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} placeholder="TN 01 AB 1234" />
                    </Field>
                    <Field label="E-way bill number">
                      <input className={styles.input} value={eWayBillNumber} onChange={(e) => setEWayBillNumber(e.target.value)} placeholder="12-digit number" />
                    </Field>
                  </div>
                </section>
              )}

              <section className={`${styles.card} ${styles.itemsCard}`}>
                <SectionHeading
                  icon={<Package size={18} />}
                  title="Items & catalog"
                  description="Add catalog or custom goods and services"
                  trailing={<span className={styles.count}>{totals.count} {totals.count === 1 ? 'item' : 'items'}</span>}
                />
                <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Line items table; scroll horizontally">
                  <table className={styles.table}>
                    <caption className="sr-only">Items, quantities, prices, taxes and amounts</caption>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Item / Description</th>
                          {!isSupplierDocument && <th scope="col">HSN/SAC</th>}
                        <th scope="col">Qty</th>
                        <th scope="col">Unit</th>
                          <th scope="col">{isSupplierDocument ? 'Price / unit (₹)' : 'Rate (₹)'}</th>
                          <th scope="col">{isSupplierDocument ? 'Tax %' : 'GST %'}</th>
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
                              onChange={(e) => pickItem(line.key, e.target.value)}
                            >
                              <option value="">Custom item / choose from catalog</option>
                              {catalog.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name}
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label={`Description ${index + 1}`}
                              className={styles.descriptionInput}
                              maxLength={200}
                              placeholder="Enter description"
                              value={line.description}
                              onChange={(e) => updateLine(line.key, { description: e.target.value })}
                            />
                          </td>
                          {!isSupplierDocument && (
                            <td>
                              <input
                                aria-label={`HSN ${index + 1}`}
                                className={styles.hsnInput}
                                placeholder="HSN"
                                value={line.hsnSac}
                                onChange={(e) => updateLine(line.key, { hsnSac: e.target.value })}
                              />
                            </td>
                          )}
                          <td>
                            <input
                              aria-label={`Quantity ${index + 1}`}
                              type="number"
                              min="0.001"
                              step="any"
                              className={styles.cellInput}
                              value={isNaN(line.quantity) ? '' : line.quantity}
                              onChange={(e) => updateLine(line.key, { quantity: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td>
                            {isSupplierDocument ? (
                              <select
                                aria-label={`Unit ${index + 1}`}
                                className={`${styles.cellInput} ${styles.purchaseSelect}`}
                                value={line.unit}
                                onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                              >
                                {optionsWithCurrent(PURCHASE_UNIT_OPTIONS, line.unit).map((unit) => (
                                  <option key={unit} value={unit}>{String(unit).toUpperCase()}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={`Unit ${index + 1}`}
                                className={styles.cellInput}
                                style={{ width: '4rem' }}
                                value={line.unit}
                                onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                              />
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
                              readOnly={!isSupplierDocument && !transactionPrefs.editPriceOnInvoice && Boolean(line.itemId)}
                              title={!isSupplierDocument && !transactionPrefs.editPriceOnInvoice && line.itemId ? 'Price editing is turned off in Transaction settings' : undefined}
                              onChange={(e) => updateLine(line.key, { unitPrice: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td>
                            {isSupplierDocument ? (
                              <select
                                aria-label={`Tax ${index + 1}`}
                                className={`${styles.cellInput} ${styles.purchaseSelect} ${styles.taxSelect}`}
                                value={line.taxRate}
                                onChange={(e) => updateLine(line.key, { taxRate: Number(e.target.value) })}
                              >
                                {optionsWithCurrent(PURCHASE_TAX_OPTIONS, line.taxRate).map((rate) => (
                                  <option key={rate} value={rate}>{Number(rate) === 0 ? 'No tax' : `GST ${rate}%`}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={`Tax ${index + 1}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                disabled={!gstRegistered}
                                className={styles.cellInput}
                                value={gstRegistered ? (isNaN(line.taxRate) ? '' : line.taxRate) : 0}
                                onChange={(e) => updateLine(line.key, { taxRate: parseFloat(e.target.value) || 0 })}
                              />
                            )}
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
                    <Plus size={16} /> {isPurchase ? 'Add row' : 'Add line'}
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
                {!isSupplierDocument && !gstRegistered && !loading && (
                  <p className={styles.taxNote}>Tax is not applied because this business is not GST registered.</p>
                )}
              </section>

              <section className={styles.card}>
                <SectionHeading
                  icon={<FileText size={18} />}
                  title={isPurchase ? 'Terms, payment & uploads' : 'Terms & Notes'}
                  description="Party instructions, payment conditions, and notices"
                  trailing={<span className={styles.optional}>Optional</span>}
                />
                <div className={`${styles.cardBody} ${styles.notesGrid}`}>
                  <Field label="Terms and conditions">
                    <textarea
                      className={styles.input}
                      rows={3}
                      maxLength={5000}
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      placeholder="Payment terms, delivery deadlines, and guarantees..."
                    />
                  </Field>
                  <Field label="Notes / Party message">
                    <textarea
                      className={styles.input}
                      rows={3}
                      maxLength={5000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Special instructions, remarks, or contact details..."
                    />
                  </Field>
                  {isPurchase && (
                    <div className={styles.purchaseTools}>
                      <Field label="Payment type">
                        <select className={styles.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                          <option value="cash">Cash</option>
                          <option value="credit">Credit</option>
                          <option value="upi">UPI</option>
                          <option value="bank_transfer">Bank transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>

                      <div className={styles.uploadArea}>
                        <span className={styles.fieldLabel}>Purchase bill files</span>
                        <input
                          ref={billInputRef}
                          className={styles.hiddenFileInput}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          multiple
                          onChange={(event) => addPurchaseAttachments(event, 'bill')}
                        />
                        <input
                          ref={imageInputRef}
                          className={styles.hiddenFileInput}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={(event) => addPurchaseAttachments(event, 'image')}
                        />
                        <input
                          ref={documentInputRef}
                          className={styles.hiddenFileInput}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                          multiple
                          onChange={(event) => addPurchaseAttachments(event, 'document')}
                        />
                        <div className={styles.uploadButtons}>
                          <button type="button" className={styles.uploadButton} onClick={() => billInputRef.current?.click()}>
                            <Upload size={16} /> Upload purchase bill
                          </button>
                          <button type="button" className={styles.uploadButton} onClick={() => imageInputRef.current?.click()}>
                            <Camera size={16} /> Add image
                          </button>
                          <button type="button" className={styles.uploadButton} onClick={() => documentInputRef.current?.click()}>
                            <FilePlus2 size={16} /> Add document
                          </button>
                        </div>
                      </div>

                      {attachments.length > 0 && (
                        <div className={styles.attachmentList} aria-label="Purchase bill attachments">
                          {attachments.map((attachment) => (
                            <div key={attachment.id} className={styles.attachmentChip}>
                              {attachment.previewUrl ? (
                                <Image src={attachment.previewUrl} width={36} height={36} unoptimized alt="" />
                              ) : (
                                <span className={styles.attachmentIcon}><FileCheck2 size={17} /></span>
                              )}
                              <span>
                                <strong>{attachment.file.name}</strong>
                                <small>{attachment.category} · {(attachment.file.size / 1024 / 1024).toFixed(1)} MB</small>
                              </span>
                              <button type="button" onClick={() => removePurchaseAttachment(attachment.id)} aria-label={`Remove ${attachment.file.name}`}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section className={styles.card}>
                <div className={styles.simpleHeading}>
                  <h3>{isPurchase ? 'Bill details' : `${config.label} details`}</h3>
                  <span className={styles.optional}>INR ₹</span>
                </div>
                <div className={`${styles.cardBody} ${styles.detailsFields}`}>
                  {isPurchase ? (
                    <Field label="Bill number">
                      <input
                        className={styles.input}
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Enter supplier bill number"
                      />
                    </Field>
                  ) : (
                    <div>
                      <span className={styles.fieldLabel}>Document number</span>
                      <div className={styles.readonlyValue}>
                        Auto-assigned
                        <span>Auto-sequence</span>
                      </div>
                    </div>
                  )}

                  <div className={styles.dateGrid}>
                    <Field label={isPurchase ? 'Bill date *' : 'Issue date *'}>
                      <input
                        type="date"
                        className={styles.input}
                        required
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </Field>

                    {(docType === 'QUOTATION' || docType === 'PROFORMA_INVOICE') && (
                      <Field label="Valid until">
                        <input
                          type="date"
                          className={styles.input}
                          min={issueDate}
                          value={validUntil}
                          onChange={(e) => setValidUntil(e.target.value)}
                        />
                      </Field>
                    )}

                    {(docType === 'PROFORMA_INVOICE' || isPurchase) && (
                      <Field label="Due date">
                        <input
                          type="date"
                          className={styles.input}
                          min={issueDate}
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>

                  {!isPurchase && (
                    <Field label="Party reference / PO number">
                      <input
                        className={styles.input}
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="e.g. PO-84920"
                      />
                    </Field>
                  )}

                  <Field label="Place of supply">
                    {isPurchase ? (
                      <select className={styles.input} value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
                        <option value="">Select state</option>
                        {optionsWithCurrent(PLACE_OF_SUPPLY_OPTIONS, placeOfSupply).map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={styles.input}
                        value={placeOfSupply}
                        onChange={(e) => setPlaceOfSupply(e.target.value)}
                        placeholder="State or destination"
                      />
                    )}
                  </Field>
                </div>
              </section>

              <section className={`${styles.card} ${styles.summary}`}>
                <div className={styles.simpleHeading}>
                  <h3>Live summary</h3>
                  <IconComponent size={16} aria-hidden="true" />
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
                      aria-label="Document discount"
                      type="number"
                      min="0"
                      step="0.01"
                      max={totals.subtotal + totals.tax}
                      value={isNaN(discount) ? '' : discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className={styles.cellInput}
                    />
                  </label>
                  <div className={styles.grandTotal} aria-live="polite">
                    <span>Total value</span>
                    <strong>{formatCurrency(totals.total)}</strong>
                    <small>Including {formatCurrency(totals.tax)} tax</small>
                  </div>
                </div>
              </section>

              <p className={styles.summaryHint}>
                <Check size={15} /> Review all details before issuing.
              </p>
            </aside>
          </fieldset>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTotal}>
          <span>Total {config.shortLabel.toLowerCase()} value</span>
          <strong>{formatCurrency(totals.total)}</strong>
          <small>
            {totals.count} {totals.count === 1 ? 'item' : 'items'}
          </small>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={onClose} disabled={Boolean(saving)} className={styles.cancelButton}>
            Cancel
          </button>
          <button type="button" disabled={disabled} onClick={() => void submit('DRAFT')} className={styles.secondaryButton}>
            {saving === 'DRAFT' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving === 'DRAFT' ? 'Saving…' : 'Save as draft'}</span>
          </button>
          {(
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
                  <button type="button" role="menuitem" onClick={() => void submit('ISSUED', 'pdf')}><Download size={16} /><span>PDF<small>Download printable PDF</small></span></button>
                  <button type="button" role="menuitem" onClick={() => void submit('ISSUED', 'document')}><FileIcon size={16} /><span>Document<small>Download editable Word file</small></span></button>
                  <button type="button" role="menuitem" onClick={() => void submit('ISSUED', 'excel')}><FileSpreadsheet size={16} /><span>Excel<small>Download spreadsheet</small></span></button>
                  <button type="button" role="menuitem" onClick={() => void submit('ISSUED', 'whatsapp')}><MessageCircle size={16} /><span>WhatsApp<small>{`Share with ${partyLabel.toLowerCase()}`}</small></span></button>
                  <button type="button" role="menuitem" onClick={() => void submit('ISSUED', 'email')}><Mail size={16} /><span>Email<small>{`Send to ${partyLabel.toLowerCase()} email`}</small></span></button>
                </div>
              )}
            </div>
          )}
          <button type="button" disabled={disabled} onClick={() => void submit('ISSUED')} className={styles.saveButton}>
            {saving === 'ISSUED' ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            <span>{saving === 'ISSUED' ? 'Saving…' : isPurchase ? 'Save' : 'Save and issue'}</span>
          </button>
        </div>
      </footer>

      {showSupplierModal && (
        <SupplierQuickModal
          onClose={() => setShowSupplierModal(false)}
          onSaved={(supplier) => {
            setSuppliers((curr) => [...curr, supplier].sort((a, b) => a.name.localeCompare(b.name)));
            setPartyId(supplier.id);
            setShowSupplierModal(false);
          }}
        />
      )}
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

function SectionHeading({
  icon,
  title,
  description,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  trailing?: ReactNode;
}) {
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

function SupplierQuickModal({ onClose, onSaved }: { onClose: () => void; onSaved: (supplier: Supplier) => void }) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', gstin: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || undefined]));
      const { data } = await api.post<Supplier>('/suppliers', payload);
      onSaved(data);
    } catch (err) {
      setError(getApiError(err, 'Could not add supplier.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Supplier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div>
          <label className="label">Supplier Name *</label>
          <input
            required
            autoFocus
            className="input-field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contact Person</label>
            <input
              className="input-field"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input
              maxLength={15}
              className="input-field uppercase"
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input-field"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            rows={2}
            className="input-field resize-none"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Add Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
