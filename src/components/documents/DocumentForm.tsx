'use client';
import TransactionDetailsFields,{emptyTransactionDetails,transactionDetailsPayload} from '@/components/TransactionDetailsFields';
import { trackingFields } from '@/lib/tracking';
import { TrackingBlanks, TrackingCells, TrackingHeaders } from '@/components/TrackingCells';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from '@/components/ToastProvider';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronDown,
  Download,
  File as FileIcon,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  PlusCircle,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react';
import Modal from '@/components/Modal';
import { api, getActiveBusinessId, getAllPages, getApiError, setActiveBusinessId } from '@/lib/api';
import { DOCUMENT_CONFIG, DOCUMENT_TYPES, type DocumentConfig } from '@/lib/documents';
import { formatCurrency } from '@/lib/format';
import { prepareUploads } from '@/lib/imageCompression';
import { takePendingBillUploads } from '@/lib/pendingBillUploads';
import type { Business, BusinessDocument, BusinessDocumentItem, BusinessDocumentType, Invoice, Item, Party, Supplier } from '@/types';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';
import { CHARGES, CompanyChip, EditorTabBar, GodownPill, GST_RATES, MetaRow, noCharges, PAYMENT_TERMS, SUPPLY_STATES, addDays, today } from '@/components/transactions/EditorParts';
import { calculateDocument, type DocumentDraftLine } from './documentTotals';
import { totalsOptionsFor } from '../invoices/invoiceTotals';
import { normalizePreferences, type CompanyPreferences, type Preferences } from '@/lib/preferences';
import { usePreferences } from '@/lib/useGeneralPreferences';
import { renderMessage, whatsappLink } from '@/lib/messageTemplates';
import styles from '@/components/transactions/TransactionEditor.module.css';

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

const UNIT_OPTIONS = ['pcs', 'nos', 'kg', 'g', 'ltr', 'ml', 'm', 'cm', 'box', 'set', 'pair', 'hr', 'day'];
const PAYMENT_MODES = [['cash', 'Cash'], ['cheque', 'Cheque'], ['upi', 'UPI']] as const;

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

type CashAccount = { id: string; bankName: string; accountNumber?: string };
/** `source` is "credit", a payment mode such as "cash", or a cash/bank account id. */
type PaymentRow = { key: string; source: string; amount: string; reference: string };

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
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState(() => getActiveBusinessId() ?? '');
  // Registers only list the active company, so saving into another one must be called out.
  const [activeBusinessId] = useState(() => getActiveBusinessId() ?? '');
  const [documentPreferences, setDocumentPreferences] = useState<CompanyPreferences | null>(null);
  const [gstRegistered, setGstRegistered] = useState(true);

  const [partyId, setPartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [transactionInfo,setTransactionInfo]=useState(emptyTransactionDetails);
  const [referenceInvoiceId, setReferenceInvoiceId] = useState('');
  const [sourceDocumentId, setSourceDocumentId] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState('');
  const termTouched = useRef(false);
  const [termDays, setTermDays] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState('');
  const discountByPercent = useRef(false);
  const [charges, setCharges] = useState(noCharges);
  const [roundOffChoice, setRoundOffChoice] = useState<boolean | null>(null);
  const [taxChoice, setTaxChoice] = useState<number | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [reason, setReason] = useState('');
  const [returnStock, setReturnStock] = useState(false);
  const [terms, setTerms] = useState('Thanks for doing business with us!');
  const [notes, setNotes] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [lines, setLines] = useState<DocumentDraftLine[]>(() => [emptyLine(), emptyLine()]);
  const [payments, setPayments] = useState<PaymentRow[]>(() => [{ key: generateLineId(), source: 'cash', amount: '', reference: '' }]);
  const [attachments, setAttachments] = useState<PurchaseAttachment[]>([]);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

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
  const billInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<PurchaseAttachment[]>([]);
  // ?editId=<id> edits a saved document in place; ?duplicateId=<id> starts a new one from a copy.
  const sourceRequest = useRef(typeof window === 'undefined' ? { editId: '', duplicateId: '' } : (() => {
    const params = new URLSearchParams(window.location.search);
    return { editId: params.get('editId') ?? '', duplicateId: params.get('duplicateId') ?? '' };
  })());
  const sourceLoaded = useRef(false);
  const editingId = sourceRequest.current.editId;
  const [editingStatus, setEditingStatus] = useState<BusinessDocument['status'] | ''>('');
  const [editingNumber, setEditingNumber] = useState('');
  const [sourceDocument, setSourceDocument] = useState<BusinessDocument | null>(null);

  // Fill the form from the document being edited or duplicated. A duplicate keeps today's date and a new number.
  useEffect(() => {
    if (!sourceDocument) return;
    const source = sourceDocument;
    const edit = Boolean(sourceRequest.current.editId);
    setDocType(source.type);
    setPartyId(source.supplierId ?? source.partyId ?? '');
    setWarehouseId(source.warehouseId ?? '');
    setTransactionInfo({
      billingName: source.billingName ?? '',
      transportName: source.transportName ?? '',
      deliveryLocation: source.deliveryLocation ?? '',
      lrNumber: source.lrNumber ?? '',
      eWayBillNumber: source.eWayBillNumber ?? '',
      noOfBags: source.noOfBags == null ? '' : String(source.noOfBags),
    });
    setReferenceInvoiceId(source.referenceInvoiceId ?? '');
    setSourceDocumentId(source.type === 'DEBIT_NOTE' ? source.sourceDocumentId ?? '' : '');
    setDiscount(Number(source.discount) || 0);
    setPlaceOfSupply(source.placeOfSupply ?? '');
    setVehicleNumber(source.vehicleNumber ?? '');
    setReason(source.reason ?? '');
    setReturnStock(Boolean(source.returnStock));
    setTerms(source.terms ?? '');
    setNotes(source.notes ?? '');
    if (source.notes) setShowDescription(true);
    if (edit) {
      setEditingStatus(source.status);
      setEditingNumber(source.documentNumber);
      setIssueDate(source.issueDate.slice(0, 10));
      setValidUntil(source.validUntil?.slice(0, 10) ?? '');
      termTouched.current = true;
      setTermDays(null);
      setDueDate(source.dueDate?.slice(0, 10) ?? '');
      setReferenceNumber(source.referenceNumber ?? '');
    }
    // Charges were saved as their own lines; put them back into the charge fields.
    const chargeFor = (line: BusinessDocumentItem) => (line.itemId ? undefined : CHARGES.find(([, , description]) => description === line.description));
    const restored = { ...noCharges };
    for (const line of source.items ?? []) {
      const charge = chargeFor(line);
      if (charge) restored[charge[0]] = String(Number(line.unitPrice));
    }
    setCharges(restored);
    const itemLines = (source.items ?? []).filter((line) => !chargeFor(line)).map((line) => ({
      ...trackingFields(line),
      key: generateLineId(),
      itemId: line.itemId,
      description: line.description,
      hsnSac: line.hsnSac || '',
      quantity: Number(line.quantity) || 1,
      unit: line.unit || 'pcs',
      unitPrice: Number(line.unitPrice) || 0,
      taxRate: Number(line.taxRate) || 0,
      taxInclusive: line.taxInclusive,
    }));
    setLines(itemLines.length ? itemLines : [emptyLine()]);
  }, [sourceDocument]);

  const isPurchase = docType === 'PURCHASE_INVOICE';
  const isDebitNote = docType === 'DEBIT_NOTE';
  const isSupplierDocument = isPurchase || isDebitNote;
  const isAdjustment = docType === 'CREDIT_NOTE' || docType === 'DEBIT_NOTE';
  const isChallan = docType === 'DELIVERY_CHALLAN';
  const hasValidity = docType === 'QUOTATION' || docType === 'PROFORMA_INVOICE';
  const hasDueDate = docType === 'PROFORMA_INVOICE' || isPurchase;
  const config: DocumentConfig = DOCUMENT_CONFIG[docType];
  const title = `${editingId ? 'Edit ' : ''}${isPurchase ? 'Purchase' : config.label}`;
  const documentTitle = isPurchase ? 'Purchase Bill' : config.label;
  const partyLabel = isSupplierDocument ? 'Supplier' : 'Customer';
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
        const [partyRes, supplierRes, itemRes, invoiceRes, purchaseBillRes, businessRes, accountRes] = await Promise.all([
          getAllPages<Party>('/parties', companyConfig),
          getAllPages<Supplier>('/suppliers', companyConfig),
          getAllPages<Item>('/items', companyConfig),
          getAllPages<Invoice>('/invoices', companyConfig),
          getAllPages<BusinessDocument>('/documents', { ...companyConfig, params: { type: 'PURCHASE_INVOICE' } }),
          getAllPages<Business>('/businesses', { signal }),
          // Accounts only feed the payment picker; a failure must not block the form.
          getAllPages<CashAccount>('/accounts', companyConfig).catch(() => ({ data: [] as CashAccount[] })),
        ]);
        if (signal.aborted) return;

        setParties(partyRes.data || []);
        setSuppliers(supplierRes.data || []);
        setCatalog(itemRes.data || []);
        setInvoices(invoiceRes.data || []);
        setPurchaseBills(purchaseBillRes.data || []);
        setBusinesses(businessRes.data || []);
        setAccounts(accountRes.data || []);

        const selectedId = businessId || getActiveBusinessId() || businessRes.data?.[0]?.id || '';
        const business = (businessRes.data || []).find(({ id }) => id === selectedId) ?? businessRes.data?.[0];
        if (business) {
          setBusinessId(business.id);
          setGstRegistered(Boolean(business.gstRegistered));
          const { data: preferences } = await api.get(`/businesses/${business.id}/preferences`, { signal });
          if (signal.aborted) return;
          setDocumentPreferences(normalizePreferences(preferences));
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

        const sourceId = sourceRequest.current.editId || sourceRequest.current.duplicateId;
        if (sourceId && !sourceLoaded.current) {
          const { data: source } = await api.get<BusinessDocument>(`/documents/${encodeURIComponent(sourceId)}`, companyConfig);
          if (signal.aborted) return;
          sourceLoaded.current = true;
          setSourceDocument(source);
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

  // Bill files picked with "Upload Purchase Bills" on the register arrive here once.
  useEffect(() => {
    if (!isPurchase) return;
    const files = takePendingBillUploads().slice(0, 10);
    if (!files.length) return;
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: generateLineId(),
        file,
        category: 'bill' as const,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      })),
    ]);
  }, [isPurchase]);

  // "Purchase return" on the register opens a debit note with ?sourceDocumentId=<bill>.
  const requestedSourceId = useRef<string | null>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sourceDocumentId') : null,
  );
  useEffect(() => {
    const sourceId = requestedSourceId.current;
    if (loading || !isDebitNote || !sourceId) return;
    requestedSourceId.current = null;
    if (purchaseBills.some(({ id }) => id === sourceId)) void pickReferencePurchaseBill(sourceId);
    // pickReferencePurchaseBill is a plain function; this must run once, after the bills load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isDebitNote, purchaseBills]);

  // Payment terms start from the company default until the user picks a term or a due date.
  useEffect(() => {
    if (!termTouched.current) setTermDays(Math.max(0, partyPrefs.defaultPaymentTermDays));
  }, [partyPrefs.defaultPaymentTermDays]);

  useEffect(() => {
    if (hasDueDate && termDays !== null && issueDate) setDueDate(addDays(issueDate, termDays));
  }, [hasDueDate, issueDate, termDays]);

  function updateLine(key: string, patch: Partial<DocumentDraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function pickItem(key: string, itemId: string) {
    const item = catalog.find(({ id }) => id === itemId);
    if (!item) {
      updateLine(key, { itemId: undefined });
      return;
    }
    const itemPrice = Number(isSupplierDocument ? item.purchasePrice ?? 0 : item.salePrice);
    const itemTaxRate = Number(item.taxRate);
    updateLine(key, {
      ...trackingFields(item),
      itemId: item.id,
      description: item.name,
      hsnSac: item.hsnSac || '',
      taxInclusive: (isSupplierDocument ? item.purchasePriceTaxMode : item.salePriceTaxMode) === 'WITH_TAX',
      unit: item.unit || 'pcs',
      unitPrice: Number.isFinite(itemPrice) ? itemPrice : 0,
      taxRate: isSupplierDocument || gstRegistered ? (Number.isFinite(itemTaxRate) ? itemTaxRate : 0) : 0,
    });
  }

  /** Typing a catalog name links the item; other text is kept as the line description. */
  function typeItem(line: DocumentDraftLine, text: string) {
    const match = catalog.find(({ name }) => name.toLowerCase() === text.trim().toLowerCase());
    if (match && match.id !== line.itemId) pickItem(line.key, match.id);
    else updateLine(line.key, text.trim() ? { description: text } : { description: '', itemId: undefined });
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
            ...trackingFields(item),
            key: generateLineId(),
            itemId: item.itemId,
            description: item.description,
            hsnSac: item.hsnSac || '',
            quantity: Number(item.quantity) || 1,
            unit: item.unit || 'pcs',
            unitPrice: Number(item.unitPrice) || 0,
            taxRate: Number(item.taxRate) || 0,
            taxInclusive: item.taxInclusive,
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

  function updatePayment(key: string, patch: Partial<PaymentRow>) {
    setPayments((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const chargeLines = useMemo(() => CHARGES.flatMap(([key, , description]): DocumentDraftLine[] => {
    const amount = Number(charges[key]);
    return Number.isFinite(amount) && amount > 0 ? [{ ...emptyLine(), key: `charge-${key}`, description, unitPrice: amount }] : [];
  }), [charges]);
  // A negative adjustment cannot be a line (prices must be >= 0), so it is applied as extra discount.
  const adjustmentDiscount = Math.max(0, -(Number(charges.adjustment) || 0));
  const roundOff = roundOffChoice ?? Boolean(transactionPrefs.autoRoundOff);
  const totalOptions = useMemo(() => ({ ...totalsOptionsFor(transactionPrefs, taxPrefs, !isSupplierDocument), roundOff }), [transactionPrefs, taxPrefs, isSupplierDocument, roundOff]);
  const taxAllowed = isSupplierDocument || gstRegistered;
  const totals = useMemo(() => calculateDocument([...lines, ...chargeLines], discount + adjustmentDiscount, taxAllowed, totalOptions), [adjustmentDiscount, chargeLines, discount, lines, taxAllowed, totalOptions]);
  const itemTotals = useMemo(() => calculateDocument(lines, 0, taxAllowed, { noTax: totalOptions.noTax }), [lines, taxAllowed, totalOptions.noTax]);
  const discountBase = totals.subtotal + totals.tax;
  const showTax = taxAllowed && !totalOptions.noTax;
  const activeRates = [...new Set(lines.filter((_, index) => totals.lines[index]?.active).map(({ taxRate }) => taxRate))];
  const termOptions = termDays !== null && !PAYMENT_TERMS.includes(termDays) ? [...PAYMENT_TERMS, termDays].sort((a, b) => a - b) : PAYMENT_TERMS;
  // Documents always show every tracking column, matching the reference layout.
  const trackingColumns: Preferences<'item'> = useMemo(() => ({ ...(documentPreferences?.item ?? global_itemPrefs), showSerial: true, showCount: true, showBatch: true, showBarcode: true, showMrp: true, showBrand: true }), [documentPreferences?.item, global_itemPrefs]);
  const countTotal = lines.reduce((sum, line) => sum + (Number(line.count) || 0), 0);
  const selectedParty = availableParties.find(({ id }) => id === partyId);
  const disabled = loading || Boolean(loadError) || Boolean(saving) || Boolean(savedId);
  const newLine = () => ({ ...emptyLine(), taxRate: taxChoice ?? 0 });
  const splitPayments = payments.length > 1;
  const paidNow = isPurchase
    ? splitPayments
      ? payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
      : payments[0]?.source === 'credit' ? 0 : totals.total
    : 0;

  useEffect(() => {
    if (!discountByPercent.current) return;
    const percent = parseFloat(discountPercent) || 0;
    setDiscount(Math.round(discountBase * percent) / 100);
  }, [discountBase, discountPercent]);

  function paymentRequest(row: PaymentRow, amount: number) {
    const account = accounts.find(({ id }) => id === row.source);
    return {
      amount,
      method: account ? 'bank_transfer' : row.source,
      accountId: account?.id,
      reference: row.reference.trim() || undefined,
    };
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
    const itemLines = normalizedLines.filter((line) => line.description || line.itemId || line.unitPrice !== 0);
    if (!itemLines.length) return setError('Add at least one item with a description.');

    for (const line of itemLines) {
      const rowNumber = normalizedLines.findIndex(({ key }) => key === line.key) + 1;
      if (!line.description) return setError(`Row ${rowNumber}: enter an item description.`);
      if (line.description.length > 200) return setError(`Row ${rowNumber}: description must be 200 characters or fewer.`);
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) return setError(`Row ${rowNumber}: quantity must be greater than zero.`);
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) return setError(`Row ${rowNumber}: enter a valid price of zero or more.`);
      if (!Number.isFinite(line.taxRate) || line.taxRate < 0 || line.taxRate > 100) {
        return setError(`Row ${rowNumber}: select a tax rate between 0% and 100%.`);
      }
    }
    const enteredLines = [...itemLines, ...chargeLines];

    const safeDiscount = (Number.isFinite(discount) ? discount : 0) + adjustmentDiscount;
    if (safeDiscount < 0 || safeDiscount > totals.subtotal + totals.tax) {
      return setError('Discount cannot exceed the total document value.');
    }

    // Payments are only recorded against an issued purchase bill.
    const paymentRows = isPurchase && status === 'ISSUED' && totals.total > 0
      ? splitPayments
        ? payments.filter((row) => Number(row.amount) > 0).map((row) => paymentRequest(row, Number(row.amount)))
        : payments[0] && payments[0].source !== 'credit' ? [paymentRequest(payments[0], totals.total)] : []
      : [];
    if (splitPayments && paidNow > totals.total + 0.005) return setError('Payments add up to more than the bill total.');

    setBusy(true);
    setSaving(shareTarget ? `SHARE_${shareTarget}` : status);
    let createdId = '';

    try {
      const payload = {
        ...transactionDetailsPayload(transactionInfo),
        type: docType,
        requestId:saveRequestId.current,
        warehouseId: warehouseId || undefined,
        status,
        partyId: isSupplierDocument ? undefined : partyId,
        supplierId: isSupplierDocument ? partyId : undefined,
        referenceInvoiceId: docType === 'CREDIT_NOTE' ? referenceInvoiceId : undefined,
        sourceDocumentId: isDebitNote ? sourceDocumentId : undefined,
        issueDate,
        validUntil: hasValidity ? validUntil || undefined : undefined,
        dueDate: hasDueDate ? dueDate || undefined : undefined,
        discount: safeDiscount,
        roundOff: roundOffChoice ?? undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        placeOfSupply: placeOfSupply.trim() || undefined,
        vehicleNumber: isChallan ? vehicleNumber.trim().toUpperCase() || undefined : undefined,
        reason: isAdjustment ? reason.trim() || undefined : undefined,
        returnStock: isAdjustment ? returnStock : undefined,
        terms: terms.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: isPurchase ? (paymentRows.length ? paymentRows[0].method : 'credit') : undefined,
        items: enteredLines.map((line) => ({
          ...trackingFields(line),
          itemId: line.itemId,
          description: (line.description || '').trim(),
          hsnSac: isSupplierDocument ? undefined : (line.hsnSac || '').trim() || undefined,
          quantity: line.quantity,
          unit: line.unit || 'pcs',
          unitPrice: line.unitPrice,
          taxRate: taxAllowed ? line.taxRate : 0,
          taxInclusive: line.taxInclusive,
        })),
      };

      const { data } = editingId
        ? await api.patch<BusinessDocument>(`/documents/${editingId}`, payload, { headers: { 'X-Business-Id': businessId } })
        : await api.post<BusinessDocument>('/documents', payload, { headers: { 'X-Business-Id': businessId } });
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
      for (const [index, payment] of paymentRows.entries()) {
        await api.post(`/documents/${data.id}/payments`, { ...payment, requestId: saveRequestId.current ? `${saveRequestId.current.slice(0, -2)}${String(index).padStart(2, '0')}` : undefined }, {
          headers: { 'X-Business-Id': businessId },
        });
      }
      if (shareTarget) await runDocumentShare(shareTarget, data);
      if (otherCompany) {
        toast.success(`${config.label} saved in ${otherCompany}`, {
          description: `${data.documentNumber} is listed under ${otherCompany}, not the company you are working in.`,
          duration: 10000,
          action: { label: `Switch to ${otherCompany}`, onClick: () => { setActiveBusinessId(businessId); window.location.href = config.registerPath; } },
        });
      } else {
        toast.success(shareTarget ? `${config.label} saved and shared` : `${config.label} ${editingId ? 'updated' : 'saved'}`, { description: data.documentNumber });
      }
      router.push(`/documents/${data.id}?companyId=${encodeURIComponent(businessId)}${!shareTarget && status === 'ISSUED' && messagePrefs.autoShareOnSave && !isSupplierDocument ? '&share=whatsapp' : ''}`);
    } catch (saveError: unknown) {
      const message = createdId
          ? `${config.label} saved, but an upload, payment or sharing step could not be completed. Open the saved ${config.label.toLowerCase()} to review it.`
          : getApiError(saveError, `Could not save ${config.label.toLowerCase()}. Your details are still here.`);
      setError(message);
      toast.error(createdId ? `${config.label} partially completed` : `${config.label} was not saved`, { description: message, duration: 7000 });
    } finally {
      setBusy(false);
      setSaving('');
    }
  }

  const partyLocked = (docType === 'CREDIT_NOTE' && Boolean(referenceInvoiceId)) || (isDebitNote && Boolean(sourceDocumentId));
  const otherCompany = activeBusinessId && businessId && businessId !== activeBusinessId
    ? businesses.find(({ id }) => id === businessId)?.name ?? 'another company'
    : '';

  return (
    <div className={styles.editor}>
      <EditorTabBar label={`${title}${referenceNumber.trim() ? ` #${referenceNumber.trim()}` : ''}`} newHref={config.createPath} onClose={onClose} closeDisabled={Boolean(saving)} />

      <header className={styles.header}>
        <div className={styles.headerStart}>
          <h1>{title}</h1>
          {allowTypeSwitch && !editingId && (
            <>
              <span className={styles.divider} aria-hidden="true" />
              <div className={styles.typeTabs} role="tablist" aria-label="Document types">
                {DOCUMENT_TYPES.map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={docType === t} className={docType === t ? styles.typeTabActive : ''} onClick={() => switchType(t)}>
                    {DOCUMENT_CONFIG[t].shortLabel}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className={styles.headerEnd}>
          <GodownPill value={warehouseId} onChange={setWarehouseId} businessId={businessId} />
          <CompanyChip
            businesses={businesses}
            value={businessId}
            disabled={Boolean(saving) || Boolean(savedId)}
            onChange={(nextId) => {
              setDocumentPreferences(null); setLoading(true); setPartyId(''); setWarehouseId('');
              setBusinessId(nextId);
              setGstRegistered(Boolean(businesses.find(({ id }) => id === nextId)?.gstRegistered));
            }}
          />
        </div>
      </header>

      <main className={styles.scrollArea}>
        {otherCompany && !savedId && (
          <div role="status" className={styles.notice}>
            <AlertCircle size={18} />
            <div>
              This {config.label.toLowerCase()} will be saved in <strong>{otherCompany}</strong>. It will show in {otherCompany}&apos;s registers, not in the company you are working in.
              <button type="button" disabled={Boolean(saving)} onClick={() => { setDocumentPreferences(null); setLoading(true); setPartyId(''); setWarehouseId(''); setBusinessId(activeBusinessId); }}>
                Use {businesses.find(({ id }) => id === activeBusinessId)?.name ?? 'my company'} instead
              </button>
            </div>
          </div>
        )}
        {(error || loadError) && (
          <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
            <AlertCircle size={18} />
            <div>
              {error || loadError}
              {loadError && <button type="button" onClick={() => setLoadVersion((v) => v + 1)}>Try again</button>}
              {savedId && (
                <button type="button" onClick={() => router.push(`/documents/${savedId}?companyId=${encodeURIComponent(businessId)}`)}>
                  Open saved document <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <fieldset disabled={disabled} className={styles.form}>
          <legend className="sr-only">{config.label} details</legend>

          <section className={styles.partySection}>
            <div className={styles.partyFields}>
              <div className={styles.partyColumn}>
                <label className={`${styles.floating} ${partyId ? '' : styles.floatingFocus}`}>
                  <span>{isSupplierDocument ? 'Search by Name/Phone' : partyLabel} <b>*</b></span>
                  <select value={partyId} disabled={partyLocked} onChange={(e) => setPartyId(e.target.value)}>
                    <option value="">{loading ? 'Loading…' : ''}</option>
                    {availableParties.map((p) => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` · ${p.phone}` : ''}</option>)}
                  </select>
                  <ChevronDown size={18} aria-hidden="true" />
                </label>
                {selectedParty && (
                  <div className={styles.partyInfo}>
                    {'balanceDue' in selectedParty && <span>Bal: <strong>{formatCurrency(selectedParty.balanceDue ?? 0)}</strong></span>}
                    {selectedParty.phone && <p>{selectedParty.phone}</p>}
                  </div>
                )}
                {isSupplierDocument && (
                  <button type="button" className={styles.linkButton} onClick={() => setShowSupplierModal(true)}><Plus size={14} /> Add supplier</button>
                )}
              </div>
              <span aria-hidden="true" />
              <div className={styles.partyColumn}>
                <input className={styles.input} aria-label="E-Way Bill No." placeholder="E-Way Bill No." value={transactionInfo.eWayBillNumber} onChange={(e) => setTransactionInfo({ ...transactionInfo, eWayBillNumber: e.target.value })} />
              </div>
              {isAdjustment && (
                <div className={styles.adjustmentFields}>
                  {isDebitNote ? (
                    <label className={styles.floating}>
                      <span>Original purchase bill <b>*</b></span>
                      <select value={sourceDocumentId} onChange={(e) => void pickReferencePurchaseBill(e.target.value)}>
                        <option value="" />
                        {purchaseBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.documentNumber} · {bill.supplier?.name || 'Supplier'} · {formatCurrency(bill.grandTotal)}</option>)}
                      </select>
                      <ChevronDown size={18} aria-hidden="true" />
                    </label>
                  ) : (
                    <label className={styles.floating}>
                      <span>Original sale invoice <b>*</b></span>
                      <select value={referenceInvoiceId} onChange={(e) => void pickReferenceInvoice(e.target.value)}>
                        <option value="" />
                        {invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoiceNumber} · {inv.party?.name} · {formatCurrency(inv.grandTotal)}</option>)}
                      </select>
                      <ChevronDown size={18} aria-hidden="true" />
                    </label>
                  )}
                  <input className={styles.input} aria-label="Reason for adjustment" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason: goods return, rate difference…" />
                  <label className={styles.checkRow}><input type="checkbox" checked={returnStock} onChange={(event) => setReturnStock(event.target.checked)} /> Goods returned: update stock</label>
                </div>
              )}
            </div>

            <div className={styles.meta}>
              {isPurchase ? (
                <MetaRow label="Bill Number">
                  <input aria-label="Bill number" value={referenceNumber} maxLength={60} onChange={(e) => setReferenceNumber(e.target.value)} />
                </MetaRow>
              ) : (
                <>
                  <MetaRow label={`${config.shortLabel} No.`}>
                    <output>{editingNumber || 'Auto-assigned'}</output>
                  </MetaRow>
                  <MetaRow label="Reference No.">
                    <input aria-label="Reference or PO number" value={referenceNumber} maxLength={60} placeholder="PO number" onChange={(e) => setReferenceNumber(e.target.value)} />
                  </MetaRow>
                </>
              )}
              <MetaRow label={isPurchase ? 'Bill Date' : 'Date'}>
                <input type="date" required aria-label={isPurchase ? 'Bill date' : 'Date'} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                <CalendarDays size={16} aria-hidden="true" />
              </MetaRow>
              {hasValidity && (
                <MetaRow label="Valid Until">
                  <input type="date" aria-label="Valid until" min={issueDate} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                  <CalendarDays size={16} aria-hidden="true" />
                </MetaRow>
              )}
              {hasDueDate && (
                <>
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
                    <input type="date" aria-label="Due date" min={issueDate} value={dueDate} onChange={(e) => { termTouched.current = true; setTermDays(null); setDueDate(e.target.value); }} />
                    <CalendarDays size={16} aria-hidden="true" />
                  </MetaRow>
                </>
              )}
              {isChallan && (
                <MetaRow label="Vehicle No.">
                  <input aria-label="Vehicle number" value={vehicleNumber} placeholder="TN 01 AB 1234" onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} />
                </MetaRow>
              )}
              <MetaRow label="State of supply">
                <select aria-label="State of supply" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} className={placeOfSupply ? '' : styles.placeholder}>
                  <option value="">Select</option>
                  {optionsWithCurrent(SUPPLY_STATES, placeOfSupply).map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </MetaRow>
            </div>
          </section>

          <section className={styles.itemsSection}>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Line items; scroll horizontally to view all columns">
              <table className={styles.table}>
                <caption className="sr-only">Items, quantities, prices and amounts</caption>
                <thead>
                  <tr>
                    <th scope="col" className={styles.numberCol}>#</th>
                    <th scope="col" className={styles.itemCol}>Item</th>
                    {!isSupplierDocument && <th scope="col" className={styles.hsnCol}>HSN/SAC</th>}
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
                        <button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setLines((current) => (current.length === 1 ? [emptyLine()] : current.filter(({ key }) => key !== line.key)))}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                      <td>
                        <input aria-label={`Item ${index + 1}`} list="document-catalog" className={styles.cellInput} maxLength={200} value={line.description} onChange={(e) => typeItem(line, e.target.value)} />
                      </td>
                      {!isSupplierDocument && (
                        <td>
                          <input aria-label={`HSN ${index + 1}`} className={styles.cellInput} value={line.hsnSac} onChange={(e) => updateLine(line.key, { hsnSac: e.target.value })} />
                        </td>
                      )}
                      <TrackingCells preferences={trackingColumns} line={line} index={index} onChange={(patch) => updateLine(line.key, patch)} />
                      <td>
                        <input aria-label={`Quantity ${index + 1}`} type="number" min="0.001" step="any" className={styles.cellInput} value={isNaN(line.quantity) ? '' : line.quantity} onChange={(e) => updateLine(line.key, { quantity: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td>
                        <select aria-label={`Unit ${index + 1}`} className={styles.cellInput} value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })}>
                          {optionsWithCurrent(UNIT_OPTIONS, line.unit).map((unit) => <option key={unit} value={unit}>{String(unit).toUpperCase()}</option>)}
                        </select>
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
                    {!isSupplierDocument && <td />}
                    <TrackingBlanks preferences={trackingColumns} values={{ count: countTotal }} />
                    <td className={styles.right}>{itemTotals.quantity}</td>
                    <td />
                    <td />
                    <td className={styles.right}>{formatCurrency(itemTotals.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <datalist id="document-catalog">
                {catalog.map((item) => <option key={item.id} value={item.name} />)}
              </datalist>
            </div>
          </section>

          <section className={styles.bottomSection}>
            <div className={styles.logistics}>
              <TransactionDetailsFields value={transactionInfo} onChange={setTransactionInfo} />
              <div className={styles.termsCard}>
                <h3>Terms &amp; Conditions</h3>
                <label className={styles.floating}>
                  <span>Title</span>
                  <output>{documentTitle}</output>
                </label>
                <textarea aria-label="Terms and conditions" rows={3} maxLength={5000} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, delivery deadlines, guarantees…" />
              </div>
            </div>

            <div className={styles.extras}>
              {isPurchase && (
                <div className={styles.paymentBlock}>
                  {payments.map((row, index) => (
                    <div key={row.key} className={styles.paymentRow}>
                      <label className={styles.floating}>
                        <span>Payment Type</span>
                        <select value={row.source} onChange={(e) => updatePayment(row.key, { source: e.target.value })}>
                          {!splitPayments && <option value="credit">Credit (pay later)</option>}
                          {PAYMENT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}{account.accountNumber ? ` ••${account.accountNumber.slice(-4)}` : ''}</option>)}
                        </select>
                        <ChevronDown size={16} aria-hidden="true" />
                      </label>
                      {splitPayments && (
                        <input className={styles.input} type="number" min="0" step="0.01" aria-label={`Payment ${index + 1} amount`} placeholder="Amount" value={row.amount} onChange={(e) => updatePayment(row.key, { amount: e.target.value })} />
                      )}
                      {row.source !== 'credit' && row.source !== 'cash' && (
                        <input className={styles.input} aria-label={`Payment ${index + 1} reference`} placeholder="Reference No." maxLength={100} value={row.reference} onChange={(e) => updatePayment(row.key, { reference: e.target.value })} />
                      )}
                      {splitPayments && (
                        <button type="button" className={styles.removePayment} aria-label={`Remove payment ${index + 1}`} onClick={() => setPayments((current) => current.filter(({ key }) => key !== row.key))}><X size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setPayments((current) => [
                      ...current.map((row) => ({ ...row, source: row.source === 'credit' ? 'cash' : row.source, amount: row.amount || (current.length === 1 ? String(totals.total) : '') })),
                      { key: generateLineId(), source: 'cash', amount: '', reference: '' },
                    ])}
                  >
                    <Plus size={14} /> Add Payment type
                  </button>
                  {splitPayments && <p className={styles.paymentHint}>Paying {formatCurrency(paidNow)} of {formatCurrency(totals.total)}</p>}
                </div>
              )}
              {showDescription ? (
                <label className={styles.noteField}>
                  <span>Description</span>
                  <textarea rows={3} maxLength={5000} placeholder="Special instructions, remarks or contact details…" value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus={!notes} />
                </label>
              ) : (
                <button type="button" className={styles.extraButton} onClick={() => setShowDescription(true)}><FileText size={17} /> ADD DESCRIPTION</button>
              )}
              {isPurchase && (
                <>
                  <input ref={billInputRef} className={styles.hiddenFileInput} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple onChange={(event) => addPurchaseAttachments(event, 'bill')} />
                  <input ref={imageInputRef} className={styles.hiddenFileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => addPurchaseAttachments(event, 'image')} />
                  <input ref={documentInputRef} className={styles.hiddenFileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple onChange={(event) => addPurchaseAttachments(event, 'document')} />
                  <button type="button" className={styles.extraButton} onClick={() => imageInputRef.current?.click()}><Camera size={17} /> ADD IMAGE</button>
                  <button type="button" className={styles.extraButton} onClick={() => documentInputRef.current?.click()}><FilePlus2 size={17} /> ADD DOCUMENT</button>
                  {attachments.length > 0 && (
                    <div className={styles.attachmentList} aria-label="Purchase bill attachments">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className={styles.attachmentChip}>
                          {attachment.previewUrl ? <Image src={attachment.previewUrl} width={32} height={32} unoptimized alt="" /> : <span className={styles.documentIcon}><FileCheck2 size={16} /></span>}
                          <span>
                            <strong>{attachment.file.name}</strong>
                            <small>{attachment.category === 'bill' ? 'Bill' : attachment.category === 'image' ? 'Image' : 'Document'} · {(attachment.file.size / 1024 / 1024).toFixed(1)} MB</small>
                          </span>
                          <button type="button" onClick={() => removePurchaseAttachment(attachment.id)} aria-label={`Remove ${attachment.file.name}`}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={styles.totals} aria-label="Totals">
              <div className={styles.totalsRow}>
                <span>Discount</span>
                <div className={styles.discountInputs}>
                  <label className={styles.suffixInput}>
                    <input aria-label="Discount percent" type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(e) => { discountByPercent.current = true; setDiscountPercent(e.target.value); }} />
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
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0;
                        discountByPercent.current = false;
                        setDiscount(amount);
                        setDiscountPercent(amount && discountBase ? String(Math.round((amount / discountBase) * 10000) / 100) : '');
                      }}
                    />
                    <small>(₹)</small>
                  </label>
                </div>
              </div>
              <div className={styles.totalsRow}>
                <span>Tax</span>
                <select
                  aria-label="Tax for all items"
                  disabled={!showTax}
                  value={!showTax ? '' : activeRates.length === 1 ? String(activeRates[0]) : activeRates.length === 0 && taxChoice !== null ? String(taxChoice) : ''}
                  onChange={(e) => { const rate = Number(e.target.value); setTaxChoice(rate); setLines((current) => current.map((line) => ({ ...line, taxRate: rate }))); }}
                >
                  {(!showTax || activeRates.length !== 1) && <option value="">{!showTax ? 'NONE' : activeRates.length > 1 ? 'Mixed' : 'NONE'}</option>}
                  {GST_RATES.map((rate) => <option key={rate} value={rate}>{rate === 0 ? 'None' : `GST@${rate}%`}</option>)}
                </select>
                <output>{formatCurrency(totals.tax)}</output>
              </div>
              {!showTax && !loading && (
                <p className={styles.taxHint}>
                  {totalOptions.noTax ? 'Composition scheme is on, so sales carry no tax.' : 'This company is not GST-registered, so tax is not applied.'}
                </p>
              )}
              {CHARGES.map(([key, label]) => (
                <div key={key} className={styles.totalsRow}>
                  <span>{label}</span>
                  <input aria-label={`${label} amount`} type="number" min={key === 'adjustment' ? undefined : 0} step="0.01" value={charges[key]} onChange={(e) => setCharges((current) => ({ ...current, [key]: e.target.value }))} />
                  <output>{formatCurrency(Number(charges[key]) || 0)}</output>
                </div>
              ))}
              <div className={styles.grandTotal}>
                <label className={styles.roundOff}>
                  <input type="checkbox" checked={roundOff} onChange={(e) => setRoundOffChoice(e.target.checked)} />
                  <span>Round Off</span>
                </label>
                <output className={styles.roundOffValue} aria-label="Round off amount">{totals.roundOff ? Number(totals.roundOff).toFixed(2) : ''}</output>
                <span>Total</span>
                <output className={styles.totalValue} aria-live="polite">{formatCurrency(totals.total)}</output>
              </div>
              {isPurchase && (
                <div className={styles.balanceRow}>
                  <span>{paidNow > 0 ? 'Paid' : 'Balance Due'}</span>
                  <strong>{formatCurrency(paidNow > 0 ? paidNow : totals.total)}</strong>
                </div>
              )}
            </div>
          </section>
        </fieldset>
      </main>

      <footer className={styles.footer}>
        {isPurchase && (
          <button type="button" className={styles.uploadBill} disabled={disabled} onClick={() => billInputRef.current?.click()}>
            <ScanLine size={18} /> Upload Bill
          </button>
        )}
        <div className={styles.footerSpacer} />
        <div
          className={styles.shareDropdown}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setShareMenuOpen(false);
          }}
        >
          <button type="button" disabled={disabled} className={styles.shareButton} aria-haspopup="menu" aria-expanded={shareMenuOpen} onClick={() => setShareMenuOpen((open) => !open)}>
            <span>{saving.startsWith('SHARE_') && <Loader2 size={16} className="animate-spin" />}Share</span>
            <ChevronDown size={16} />
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
        {/* An issued document can't go back to draft, so editing one only offers Save. */}
        {(!editingId || editingStatus === 'DRAFT') && (
          <button type="button" disabled={disabled} onClick={() => void submit('DRAFT')} className={styles.secondaryButton}>
            {saving === 'DRAFT' && <Loader2 size={16} className="animate-spin" />}Save Draft
          </button>
        )}
        <button type="button" disabled={disabled} onClick={() => void submit('ISSUED')} className={styles.saveButton}>
          {saving === 'ISSUED' && <Loader2 size={17} className="animate-spin" />}
          <span>{saving === 'ISSUED' ? 'Saving…' : 'Save'}</span>
        </button>
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

export function SupplierQuickModal({ onClose, onSaved }: { onClose: () => void; onSaved: (supplier: Supplier) => void }) {
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
