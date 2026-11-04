'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CalendarDays,
  Camera,
  ChevronDown,
  FileCheck2,
  FilePlus2,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  PlusCircle,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import TransactionDetailsFields, { emptyTransactionDetails, transactionDetailsPayload } from '@/components/TransactionDetailsFields';
import { TrackingBlanks, TrackingCells, TrackingHeaders } from '@/components/TrackingCells';
import { toast } from '@/components/ToastProvider';
import { SupplierQuickModal } from '@/components/documents/DocumentForm';
import { calculateDocument, type DocumentDraftLine } from '@/components/documents/documentTotals';
import { totalsOptionsFor } from '@/components/invoices/invoiceTotals';
import { printPurchaseOrder } from '@/components/purchases/purchaseOrderActions';
import { CHARGES, CompanyChip, EditorTabBar, GodownPill, GST_RATES, MetaRow, noCharges, PAYMENT_TERMS, SUPPLY_STATES, addDays, today } from '@/components/transactions/EditorParts';
import { api, getActiveBusinessId, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { prepareUploads } from '@/lib/imageCompression';
import { whatsappLink } from '@/lib/messageTemplates';
import { trackingFields } from '@/lib/tracking';
import { usePreferences } from '@/lib/useGeneralPreferences';
import type { Preferences } from '@/lib/preferences';
import type { Business, BusinessDocumentAttachment, Item, PurchaseOrder, Supplier } from '@/types';
import styles from '@/components/transactions/TransactionEditor.module.css';

const UNIT_OPTIONS = ['pcs', 'nos', 'kg', 'g', 'ltr', 'ml', 'm', 'cm', 'box', 'set', 'pair', 'hr', 'day'];
const PAYMENT_MODES = [['cash', 'Cash'], ['cheque', 'Cheque'], ['upi', 'UPI'], ['other', 'Other']] as const;
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

type Account = { id: string; bankName: string; accountNumber?: string };
type NewAttachment = { id: string; file: File; category: 'image' | 'document'; previewUrl?: string };
type SaveMode = 'DRAFT' | 'SENT';
type ShareTarget = 'whatsapp' | 'email' | 'print';

const lineKey = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `po_${Date.now()}_${Math.random()}`);
const emptyLine = (): DocumentDraftLine => ({ key: lineKey(), description: '', hsnSac: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0 });
const optionsWithCurrent = (options: Array<string | number>, current: string | number) =>
  current === '' || options.some((option) => String(option).toLowerCase() === String(current).toLowerCase()) ? options : [...options, current];

/**
 * Full-screen purchase order editor laid out exactly like the purchase bill editor.
 * Pass `orderId` to edit an order, or `duplicateId` to start from a copy of one.
 */
export default function PurchaseOrderForm({ orderId, duplicateId }: { orderId?: string; duplicateId?: string }) {
  const router = useRouter();
  const editing = Boolean(orderId);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState(() => getActiveBusinessId() ?? '');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [transactionInfo, setTransactionInfo] = useState(emptyTransactionDetails);
  const [orderNumber, setOrderNumber] = useState('');
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const termTouched = useRef(false);
  const [termDays, setTermDays] = useState<number | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState('');
  const discountByPercent = useRef(false);
  const [charges, setCharges] = useState(noCharges);
  const [roundOffChoice, setRoundOffChoice] = useState<boolean | null>(null);
  const [taxChoice, setTaxChoice] = useState<number | null>(null);
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [paymentSource, setPaymentSource] = useState('credit');
  const [paymentReference, setPaymentReference] = useState('');
  const [lines, setLines] = useState<DocumentDraftLine[]>(() => [emptyLine(), emptyLine()]);
  const [attachments, setAttachments] = useState<NewAttachment[]>([]);
  const [savedAttachments, setSavedAttachments] = useState<BusinessDocumentAttachment[]>([]);
  const [status, setStatus] = useState<PurchaseOrder['status']>('DRAFT');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<'' | SaveMode | ShareTarget>('');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const sourceLoaded = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<NewAttachment[]>([]);

  const transactionPrefs = usePreferences('transaction');
  const taxPrefs = usePreferences('taxes');
  const partyPrefs = usePreferences('party');
  const itemPrefs = usePreferences('item');
  const companyHeaders = useMemo(() => (businessId ? { 'X-Business-Id': businessId } : undefined), [businessId]);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const config = { signal, headers: companyHeaders };
      const [supplierRes, itemRes, businessRes, accountRes, numberRes] = await Promise.all([
        getAllPages<Supplier>('/suppliers', config),
        getAllPages<Item>('/items', config),
        getAllPages<Business>('/businesses', { signal }),
        getAllPages<Account>('/accounts', config).catch(() => ({ data: [] as Account[] })),
        editing ? Promise.resolve(null) : api.get<{ orderNumber: string }>('/purchase-orders/next-number', config).catch(() => null),
      ]);
      if (signal.aborted) return;
      setSuppliers(supplierRes.data);
      setCatalog(itemRes.data);
      setBusinesses(businessRes.data);
      setAccounts(accountRes.data);
      if (numberRes) setSuggestedNumber(numberRes.data.orderNumber);
      if (!businessId && businessRes.data[0]) setBusinessId(businessRes.data[0].id);

      const sourceId = orderId ?? duplicateId;
      if (sourceId && !sourceLoaded.current) {
        const { data: source } = await api.get<PurchaseOrder>(`/purchase-orders/${sourceId}`, config);
        if (signal.aborted) return;
        sourceLoaded.current = true;
        setSupplierId(source.supplier.id);
        setWarehouseId(source.warehouseId ?? '');
        setPlaceOfSupply(source.placeOfSupply ?? '');
        setTransactionInfo({
          billingName: source.billingName ?? '',
          transportName: source.transportName ?? '',
          deliveryLocation: source.deliveryLocation ?? '',
          lrNumber: source.lrNumber ?? '',
          eWayBillNumber: source.eWayBillNumber ?? '',
          noOfBags: source.noOfBags == null ? '' : String(source.noOfBags),
        });
        setTerms(source.paymentTerms ?? '');
        setNotes(source.notes ?? '');
        if (source.notes) setShowDescription(true);
        setDiscount(Number(source.discount) || 0);
        setRoundOffChoice(Boolean(source.roundOff));
        setPaymentSource(source.accountId ?? source.paymentMethod ?? 'credit');
        setPaymentReference(source.paymentReference ?? '');
        // Charges were saved as their own lines; put them back into the charge fields.
        const chargeFor = (line: PurchaseOrder['items'][number]) => (line.itemId ? undefined : CHARGES.find(([, , description]) => description === line.description));
        const restored = { ...noCharges };
        for (const line of source.items) {
          const charge = chargeFor(line);
          if (charge) restored[charge[0]] = String(Number(line.unitPrice));
        }
        setCharges(restored);
        const itemLines = source.items.filter((line) => !chargeFor(line)).map((line) => ({
          ...trackingFields(line),
          key: lineKey(),
          itemId: line.itemId ?? undefined,
          description: line.description,
          hsnSac: '',
          quantity: Number(line.quantity) || 1,
          unit: line.unit || 'pcs',
          unitPrice: Number(line.unitPrice) || 0,
          taxRate: Number(line.taxRate) || 0,
          taxInclusive: line.taxInclusive,
        }));
        setLines(itemLines.length ? itemLines : [emptyLine()]);
        if (orderId) {
          setOrderNumber(source.orderNumber);
          setOrderDate(source.orderDate.slice(0, 10));
          termTouched.current = true;
          setTermDays(null);
          setDeliveryDate(source.expectedDeliveryDate?.slice(0, 10) ?? '');
          setStatus(source.status);
          setSavedAttachments(source.attachments ?? []);
        }
      }
    } catch (failure) {
      if (!signal.aborted) setLoadError(getApiError(failure, 'Could not load purchase order details. Please try again.'));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [businessId, companyHeaders, duplicateId, editing, orderId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, loadVersion]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  useEffect(() => () => attachmentsRef.current.forEach(({ previewUrl }) => previewUrl && URL.revokeObjectURL(previewUrl)), []);

  // Payment terms start from the company default until the user picks a term or a date.
  useEffect(() => {
    if (!termTouched.current) setTermDays(Math.max(0, partyPrefs.defaultPaymentTermDays));
  }, [partyPrefs.defaultPaymentTermDays]);
  useEffect(() => {
    if (termDays !== null && orderDate) setDeliveryDate(addDays(orderDate, termDays));
  }, [orderDate, termDays]);

  const chargeLines = useMemo(() => CHARGES.flatMap(([key, , description]): DocumentDraftLine[] => {
    const amount = Number(charges[key]);
    return Number.isFinite(amount) && amount > 0 ? [{ ...emptyLine(), key: `charge-${key}`, description, unitPrice: amount }] : [];
  }), [charges]);
  // A negative adjustment cannot be a line (prices must be >= 0), so it is applied as extra discount.
  const adjustmentDiscount = Math.max(0, -(Number(charges.adjustment) || 0));
  const roundOff = roundOffChoice ?? Boolean(transactionPrefs.autoRoundOff);
  const totalOptions = useMemo(() => ({ ...totalsOptionsFor(transactionPrefs, taxPrefs, false), roundOff }), [transactionPrefs, taxPrefs, roundOff]);
  const totals = useMemo(() => calculateDocument([...lines, ...chargeLines], discount + adjustmentDiscount, true, totalOptions), [adjustmentDiscount, chargeLines, discount, lines, totalOptions]);
  const itemTotals = useMemo(() => calculateDocument(lines, 0, true, { noTax: totalOptions.noTax }), [lines, totalOptions.noTax]);
  const discountBase = totals.subtotal + totals.tax;
  const showTax = !totalOptions.noTax;
  const activeRates = [...new Set(lines.filter((_, index) => totals.lines[index]?.active).map(({ taxRate }) => taxRate))];
  const termOptions = termDays !== null && !PAYMENT_TERMS.includes(termDays) ? [...PAYMENT_TERMS, termDays].sort((a, b) => a - b) : PAYMENT_TERMS;
  // Purchase orders always show every tracking column, like the purchase bill.
  const trackingColumns: Preferences<'item'> = useMemo(() => ({ ...itemPrefs, showSerial: true, showCount: true, showBatch: true, showBarcode: true, showMrp: true, showBrand: true }), [itemPrefs]);
  const countTotal = lines.reduce((sum, line) => sum + (Number(line.count) || 0), 0);
  const supplier = suppliers.find(({ id }) => id === supplierId);
  const locked = editing && !['DRAFT', 'SENT', 'CONFIRMED'].includes(status);
  const disabled = loading || Boolean(loadError) || Boolean(saving) || locked;
  const title = editing ? 'Edit Purchase Order' : 'Purchase Order';
  const shownNumber = orderNumber.trim() || suggestedNumber;

  useEffect(() => {
    if (!discountByPercent.current) return;
    const percent = parseFloat(discountPercent) || 0;
    setDiscount(Math.round(discountBase * percent) / 100);
  }, [discountBase, discountPercent]);

  function updateLine(key: string, patch: Partial<DocumentDraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  /** Typing a catalog name links the item and fills its purchase price and tax. */
  function typeItem(line: DocumentDraftLine, text: string) {
    const match = catalog.find(({ name }) => name.toLowerCase() === text.trim().toLowerCase());
    if (match && match.id !== line.itemId) {
      const price = Number(match.purchasePrice ?? 0);
      updateLine(line.key, {
        ...trackingFields(match),
        itemId: match.id,
        description: match.name,
        hsnSac: match.hsnSac || '',
        unit: match.unit || 'pcs',
        unitPrice: Number.isFinite(price) ? price : 0,
        taxRate: Number(match.taxRate) || 0,
        taxInclusive: match.purchasePriceTaxMode === 'WITH_TAX',
      });
    } else {
      updateLine(line.key, text.trim() ? { description: text } : { description: '', itemId: undefined });
    }
  }

  function addAttachments(event: ChangeEvent<HTMLInputElement>, category: NewAttachment['category']) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    const room = Math.max(0, MAX_FILES - attachments.length - savedAttachments.length);
    let bytesLeft = Math.max(0, MAX_TOTAL_BYTES - [...attachments.map(({ file }) => file.size), ...savedAttachments.map(({ size }) => size)].reduce((sum, size) => sum + size, 0));
    const accepted = selected.filter((file) => {
      if (file.size <= 0 || file.size > MAX_FILE_BYTES || file.size > bytesLeft) return false;
      bytesLeft -= file.size;
      return true;
    }).slice(0, room);
    if (accepted.length !== selected.length) setError('You can attach up to 10 files and 25 MB total. Each file must be 10 MB or smaller.');
    setAttachments((current) => [...current, ...accepted.map((file) => ({ id: lineKey(), file, category, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined }))]);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }

  async function removeSavedAttachment(attachmentId: string) {
    if (!orderId) return;
    try {
      await api.delete(`/purchase-orders/${orderId}/attachments/${attachmentId}`, { headers: companyHeaders });
      setSavedAttachments((current) => current.filter(({ id }) => id !== attachmentId));
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not remove the file.'));
    }
  }

  function share(target: ShareTarget, order: PurchaseOrder) {
    if (target === 'print') return printPurchaseOrder(order);
    const message = `Purchase order ${order.orderNumber} dated ${order.orderDate.slice(0, 10)}\n${order.items.map((item) => `• ${item.description} × ${Number(item.quantity)} ${item.unit}`).join('\n')}\nTotal: ${formatCurrency(order.grandTotal)}${order.expectedDeliveryDate ? `\nDeliver by: ${order.expectedDeliveryDate.slice(0, 10)}` : ''}`;
    if (target === 'whatsapp') window.open(whatsappLink(supplier?.phone, message), '_blank', 'noopener,noreferrer');
    else window.open(`mailto:${encodeURIComponent(supplier?.email ?? '')}?subject=${encodeURIComponent(`Purchase order ${order.orderNumber}`)}&body=${encodeURIComponent(message)}`, '_blank');
  }

  async function submit(mode: SaveMode, shareTarget?: ShareTarget) {
    if (disabled) return;
    setError('');
    setShareMenuOpen(false);
    if (!supplierId) return setError('Select a supplier before saving this purchase order.');
    if (!orderDate) return setError('Choose the order date.');
    if (deliveryDate && deliveryDate < orderDate) return setError('Delivery date must be on or after the order date.');
    const itemLines = lines.filter((line) => line.description.trim() || line.itemId || line.unitPrice !== 0);
    if (!itemLines.length) return setError('Add at least one item with a description.');
    for (const line of itemLines) {
      const row = lines.indexOf(line) + 1;
      if (!line.description.trim()) return setError(`Row ${row}: enter an item description.`);
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) return setError(`Row ${row}: quantity must be greater than zero.`);
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) return setError(`Row ${row}: enter a valid price of zero or more.`);
    }
    const safeDiscount = (Number.isFinite(discount) ? discount : 0) + adjustmentDiscount;
    if (safeDiscount < 0 || safeDiscount > totals.subtotal + totals.tax) return setError('Discount cannot exceed the order value.');

    const account = accounts.find(({ id }) => id === paymentSource);
    setSaving(shareTarget ?? mode);
    let saved: PurchaseOrder | null = null;
    try {
      const payload = {
        ...transactionDetailsPayload(transactionInfo),
        supplierId,
        orderNumber: orderNumber.trim() || undefined,
        status: editing && status !== 'DRAFT' ? undefined : mode,
        orderDate,
        expectedDeliveryDate: deliveryDate || undefined,
        warehouseId: warehouseId || undefined,
        placeOfSupply: placeOfSupply || undefined,
        paymentTerms: terms.trim() || undefined,
        notes: notes.trim() || undefined,
        discount: safeDiscount,
        roundOff,
        paymentMethod: account ? 'bank_transfer' : paymentSource,
        accountId: account?.id,
        paymentReference: paymentSource !== 'credit' && paymentSource !== 'cash' ? paymentReference.trim() || undefined : undefined,
        items: [...itemLines, ...chargeLines].map((line) => ({
          ...trackingFields(line),
          itemId: line.itemId,
          description: line.description.trim(),
          quantity: line.quantity,
          unit: line.unit || 'pcs',
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          taxInclusive: line.taxInclusive,
        })),
      };
      ({ data: saved } = orderId
        ? await api.patch<PurchaseOrder>(`/purchase-orders/${orderId}`, payload, { headers: companyHeaders })
        : await api.post<PurchaseOrder>('/purchase-orders', payload, { headers: companyHeaders }));
      if (attachments.length) {
        const formData = new FormData();
        (await prepareUploads(attachments.map(({ file }) => file))).forEach((file) => formData.append('files', file, file.name));
        await api.post(`/purchase-orders/${saved.id}/attachments`, formData, { headers: { ...companyHeaders, 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      }
      toast.success(orderId ? 'Purchase order updated' : 'Purchase order saved', { description: `${saved.orderNumber} · ${formatCurrency(saved.grandTotal)}` });
      if (shareTarget) share(shareTarget, saved);
      // An order saved under another company is not visible from this company's pages.
      router.push(businessId === getActiveBusinessId() ? `/purchases/orders/${saved.id}` : '/purchases/orders');
    } catch (failure) {
      const message = saved
        ? `${saved.orderNumber} was saved, but its attachments could not be uploaded. Open the order to try again.`
        : getApiError(failure, 'Could not save the purchase order. Your details are still here.');
      setError(message);
      toast.error(saved ? 'Purchase order partly saved' : 'Purchase order was not saved', { description: message, duration: 7000 });
    } finally {
      setSaving('');
    }
  }

  const close = () => router.push(orderId ? `/purchases/orders/${orderId}` : '/purchases/orders');

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white">
      <div className={styles.editor}>
        <EditorTabBar label={`${title}${shownNumber ? ` #${shownNumber}` : ''}`} newHref="/purchases/orders/new" onClose={close} closeDisabled={Boolean(saving)} />

        <header className={styles.header}>
          <div className={styles.headerStart}>
            <h1>{title}</h1>
          </div>
          <div className={styles.headerEnd}>
            <GodownPill value={warehouseId} onChange={setWarehouseId} businessId={businessId} />
            <CompanyChip
              businesses={businesses}
              value={businessId}
              disabled={Boolean(saving) || editing}
              onChange={(nextId) => {
                setLoading(true); setSupplierId(''); setWarehouseId(''); setPaymentSource('credit');
                setBusinessId(nextId);
              }}
            />
          </div>
        </header>

        <main className={styles.scrollArea}>
          {(error || loadError || locked) && (
            <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
              <AlertCircle size={18} />
              <div>
                {error || loadError || 'This order has been received, cancelled or closed, so it can no longer be edited.'}
                {loadError && <button type="button" onClick={() => setLoadVersion((version) => version + 1)}>Try again</button>}
              </div>
            </div>
          )}

          <fieldset disabled={disabled} className={styles.form}>
            <legend className="sr-only">Purchase order details</legend>

            <section className={styles.partySection}>
              <div className={styles.partyFields}>
                <div className={styles.partyColumn}>
                  <label className={`${styles.floating} ${supplierId ? '' : styles.floatingFocus}`}>
                    <span>Search by Name/Phone <b>*</b></span>
                    <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                      <option value="">{loading ? 'Loading…' : ''}</option>
                      {suppliers.map((option) => <option key={option.id} value={option.id}>{option.name}{option.phone ? ` · ${option.phone}` : ''}</option>)}
                    </select>
                    <ChevronDown size={18} aria-hidden="true" />
                  </label>
                  {supplier && (
                    <div className={styles.partyInfo}>
                      {supplier.phone && <p>{supplier.phone}</p>}
                      {supplier.gstin && <p>GSTIN: {supplier.gstin}</p>}
                    </div>
                  )}
                  <button type="button" className={styles.linkButton} onClick={() => setShowSupplierModal(true)}><Plus size={14} /> Add supplier</button>
                </div>
                <span aria-hidden="true" />
                <div className={styles.partyColumn}>
                  <input className={styles.input} aria-label="E-Way Bill No." placeholder="E-Way Bill No." value={transactionInfo.eWayBillNumber} onChange={(event) => setTransactionInfo({ ...transactionInfo, eWayBillNumber: event.target.value })} />
                </div>
              </div>

              <div className={styles.meta}>
                <MetaRow label="Order No.">
                  <input aria-label="Order number" value={orderNumber} maxLength={60} placeholder={suggestedNumber || 'Auto-assigned'} onChange={(event) => setOrderNumber(event.target.value)} />
                </MetaRow>
                <MetaRow label="Order Date">
                  <input type="date" required aria-label="Order date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
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
                <MetaRow label="Delivery Date">
                  <input type="date" aria-label="Expected delivery date" min={orderDate} value={deliveryDate} onChange={(event) => { termTouched.current = true; setTermDays(null); setDeliveryDate(event.target.value); }} />
                  <CalendarDays size={16} aria-hidden="true" />
                </MetaRow>
                <MetaRow label="State of supply">
                  <select aria-label="State of supply" value={placeOfSupply} onChange={(event) => setPlaceOfSupply(event.target.value)} className={placeOfSupply ? '' : styles.placeholder}>
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
                      <TrackingHeaders preferences={trackingColumns} />
                      <th scope="col">Qty</th>
                      <th scope="col">Unit</th>
                      <th scope="col" className={styles.right}>Price/Unit</th>
                      <th scope="col" className={styles.right}>Amount</th>
                      <th scope="col" className={styles.addCol}>
                        <button type="button" aria-label="Add row" disabled={lines.length >= 200} onClick={() => setLines((current) => [...current, { ...emptyLine(), taxRate: taxChoice ?? 0 }])}><PlusCircle size={18} /></button>
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
                          <input aria-label={`Item ${index + 1}`} list="purchase-order-catalog" className={styles.cellInput} maxLength={191} value={line.description} onChange={(event) => typeItem(line, event.target.value)} />
                        </td>
                        <TrackingCells preferences={trackingColumns} line={line} index={index} onChange={(patch) => updateLine(line.key, patch)} />
                        <td>
                          <input aria-label={`Quantity ${index + 1}`} type="number" min="0.001" step="any" className={styles.cellInput} value={isNaN(line.quantity) ? '' : line.quantity} onChange={(event) => updateLine(line.key, { quantity: parseFloat(event.target.value) || 0 })} />
                        </td>
                        <td>
                          <select aria-label={`Unit ${index + 1}`} className={styles.cellInput} value={line.unit} onChange={(event) => updateLine(line.key, { unit: event.target.value })}>
                            {optionsWithCurrent(UNIT_OPTIONS, line.unit).map((unit) => <option key={unit} value={unit}>{String(unit).toUpperCase()}</option>)}
                          </select>
                        </td>
                        <td>
                          <input aria-label={`Rate ${index + 1}`} type="number" min="0" step="0.01" className={styles.cellInput} value={isNaN(line.unitPrice) ? '' : line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: parseFloat(event.target.value) || 0 })} />
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
                          <button type="button" className={styles.addRow} disabled={lines.length >= 200} onClick={() => setLines((current) => [...current, { ...emptyLine(), taxRate: taxChoice ?? 0 }])}>ADD ROW</button>
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
                <datalist id="purchase-order-catalog">
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
                    <output>Purchase Order</output>
                  </label>
                  <textarea aria-label="Terms and conditions" rows={3} maxLength={5000} value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Payment terms, delivery deadlines, guarantees…" />
                </div>
              </div>

              <div className={styles.extras}>
                <div className={styles.paymentBlock}>
                  <div className={styles.paymentRow}>
                    <label className={styles.floating}>
                      <span>Payment Type</span>
                      <select value={paymentSource} onChange={(event) => setPaymentSource(event.target.value)}>
                        <option value="credit">Credit (pay later)</option>
                        {PAYMENT_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}{account.accountNumber ? ` ••${account.accountNumber.slice(-4)}` : ''}</option>)}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" />
                    </label>
                    {paymentSource !== 'credit' && paymentSource !== 'cash' && (
                      <input className={styles.input} aria-label="Payment reference" placeholder="Reference No." maxLength={191} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                    )}
                  </div>
                </div>
                {showDescription ? (
                  <label className={styles.noteField}>
                    <span>Description</span>
                    <textarea rows={3} maxLength={5000} placeholder="Quality, packing or delivery instructions…" value={notes} onChange={(event) => setNotes(event.target.value)} autoFocus={!notes} />
                  </label>
                ) : (
                  <button type="button" className={styles.extraButton} onClick={() => setShowDescription(true)}><FileText size={17} /> ADD DESCRIPTION</button>
                )}
                <input ref={imageInputRef} className={styles.hiddenFileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => addAttachments(event, 'image')} />
                <input ref={documentInputRef} className={styles.hiddenFileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple onChange={(event) => addAttachments(event, 'document')} />
                <button type="button" className={styles.extraButton} onClick={() => imageInputRef.current?.click()}><Camera size={17} /> ADD IMAGE</button>
                <button type="button" className={styles.extraButton} onClick={() => documentInputRef.current?.click()}><FilePlus2 size={17} /> ADD DOCUMENT</button>
                {(attachments.length > 0 || savedAttachments.length > 0) && (
                  <div className={styles.attachmentList} aria-label="Purchase order attachments">
                    {savedAttachments.map((attachment) => (
                      <div key={attachment.id} className={styles.attachmentChip}>
                        <span className={styles.documentIcon}><FileCheck2 size={16} /></span>
                        <span>
                          <strong>{attachment.fileName}</strong>
                          <small>{attachment.kind === 'IMAGE' ? 'Image' : 'Document'} · saved</small>
                        </span>
                        <button type="button" onClick={() => void removeSavedAttachment(attachment.id)} aria-label={`Remove ${attachment.fileName}`}><X size={14} /></button>
                      </div>
                    ))}
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className={styles.attachmentChip}>
                        {attachment.previewUrl ? <Image src={attachment.previewUrl} width={32} height={32} unoptimized alt="" /> : <span className={styles.documentIcon}><FileCheck2 size={16} /></span>}
                        <span>
                          <strong>{attachment.file.name}</strong>
                          <small>{attachment.category === 'image' ? 'Image' : 'Document'} · {(attachment.file.size / 1024 / 1024).toFixed(1)} MB</small>
                        </span>
                        <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.file.name}`}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.totals} aria-label="Totals">
                <div className={styles.totalsRow}>
                  <span>Discount</span>
                  <div className={styles.discountInputs}>
                    <label className={styles.suffixInput}>
                      <input aria-label="Discount percent" type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(event) => { discountByPercent.current = true; setDiscountPercent(event.target.value); }} />
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
                    onChange={(event) => { const rate = Number(event.target.value); setTaxChoice(rate); setLines((current) => current.map((line) => ({ ...line, taxRate: rate }))); }}
                  >
                    {(!showTax || activeRates.length !== 1) && <option value="">{!showTax ? 'NONE' : activeRates.length > 1 ? 'Mixed' : 'NONE'}</option>}
                    {GST_RATES.map((rate) => <option key={rate} value={rate}>{rate === 0 ? 'None' : `GST@${rate}%`}</option>)}
                  </select>
                  <output>{formatCurrency(totals.tax)}</output>
                </div>
                {CHARGES.map(([key, label]) => (
                  <div key={key} className={styles.totalsRow}>
                    <span>{label}</span>
                    <input aria-label={`${label} amount`} type="number" min={key === 'adjustment' ? undefined : 0} step="0.01" value={charges[key]} onChange={(event) => setCharges((current) => ({ ...current, [key]: event.target.value }))} />
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
              </div>
            </section>
          </fieldset>
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerSpacer} />
          <div
            className={styles.shareDropdown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setShareMenuOpen(false);
            }}
          >
            <button type="button" disabled={disabled} className={styles.shareButton} aria-haspopup="menu" aria-expanded={shareMenuOpen} onClick={() => setShareMenuOpen((open) => !open)}>
              <span>{(saving === 'whatsapp' || saving === 'email' || saving === 'print') && <Loader2 size={16} className="animate-spin" />}Share</span>
              <ChevronDown size={16} />
            </button>
            {shareMenuOpen && (
              <div className={styles.shareMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => void submit('SENT', 'print')}><Printer size={16} /><span>Print<small>Save and print the order</small></span></button>
                <button type="button" role="menuitem" onClick={() => void submit('SENT', 'whatsapp')}><MessageCircle size={16} /><span>WhatsApp<small>Send to the supplier</small></span></button>
                <button type="button" role="menuitem" onClick={() => void submit('SENT', 'email')}><Mail size={16} /><span>Email<small>Send to the supplier email</small></span></button>
              </div>
            )}
          </div>
          {(!editing || status === 'DRAFT') && (
            <button type="button" disabled={disabled} onClick={() => void submit('DRAFT')} className={styles.secondaryButton}>
              {saving === 'DRAFT' && <Loader2 size={16} className="animate-spin" />}Save Draft
            </button>
          )}
          <button type="button" disabled={disabled} onClick={() => void submit('SENT')} className={styles.saveButton}>
            {saving === 'SENT' && <Loader2 size={17} className="animate-spin" />}
            <span>{saving === 'SENT' ? 'Saving…' : 'Save'}</span>
          </button>
        </footer>

        {showSupplierModal && (
          <SupplierQuickModal
            onClose={() => setShowSupplierModal(false)}
            onSaved={(created) => {
              setSuppliers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
              setSupplierId(created.id);
              setShowSupplierModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
