'use client';
import ReferenceItemForm from '@/components/ReferenceItemForm';


import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  FileSpreadsheet,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  TrendingDown,
  WalletCards,
} from 'lucide-react';

import Modal from '@/components/Modal';
import ReferenceMaster from '@/components/ReferenceMaster';
import ConfirmDialog from '@/components/ConfirmDialog';
import RowActions, { type RowAction } from '@/components/RowActions';
import StatusBadge from '@/components/StatusBadge';
import { whatsappLink } from '@/lib/messageTemplates';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { toast } from '@/components/ToastProvider';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { multiplyMoney, sumMoney } from '@/lib/billing';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { useGeneralPreferences, usePreferences } from '@/lib/useGeneralPreferences';
import type { Item } from '@/types';
const InvoiceModal = dynamic(() => import('@/components/invoices/InvoiceModal'), { ssr: false });
const DocumentModal = dynamic(() => import('@/components/documents/DocumentModal'), { ssr: false });

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

type ItemTransaction = {
  id: string;
  type: 'SALE' | 'PURCHASE';
  number: string;
  date: string;
  quantity: number;
  rate: number;
  total: number;
  status: string;
  href: string;
};

const transactionLabel = (transaction: ItemTransaction) => (transaction.type === 'SALE' ? 'Sale invoice' : 'Purchase bill');

/** The server's `href` is the record's page, which is also its API path (`/invoices/:id` or `/documents/:id`). */
const transactionResource = (transaction: ItemTransaction) => transaction.href;

/* ========================================================================== */
/* WORKSPACE                                                                  */
/* ========================================================================== */

export function ItemWorkspace({ itemId }: { itemId?: string }) {
  const { itemDescription: showDescription } = useGeneralPreferences();
  const itemPrefs = usePreferences('item');
  const isLowStock = (quantity: number) => itemPrefs.lowStockAlert && quantity <= itemPrefs.lowStockThreshold;
  const router = useRouter();
  const [selectedId,setSelectedId]=useState(itemId??'');

  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [item, setItem] = useState<Item | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState('');

  const [transactions, setTransactions] = useState<ItemTransaction[]>([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [activeForm, setActiveForm] = useState<'sale' | 'expense' | null>(null);

  const [canDeleteItem, setCanDeleteItem] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<Item | null>(null);
  const [deletingItemId, setDeletingItemId] = useState('');
  const [deleteItemError, setDeleteItemError] = useState('');
  const [confirmTransaction, setConfirmTransaction] = useState<{ transaction: ItemTransaction; action: 'cancel' | 'delete' } | null>(null);
  const [transactionBusy, setTransactionBusy] = useState(false);


  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then((user) => {
        if (active) setCanDeleteItem(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN');
      })
      .catch(() => {
        if (active) setCanDeleteItem(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /* ====================================================================== */
  /* LOAD ITEMS (list view)                                                 */
  /* ====================================================================== */

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await getAllPages<Item>('/items');
      setItems(data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load items.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [itemId, loadItems]);

  /* ====================================================================== */
  /* LOAD ITEM (detail view)                                                */
  /* ====================================================================== */

  const loadItem = useCallback(async (id: string) => {
    setItemLoading(true);
    setItemError('');

    try {
      const { data } = await api.get<Item>(`/items/${id}`);
      setItem(data);
    } catch (loadError: unknown) {
      setItem(null);
      setItemError(getApiError(loadError, 'Could not load item.'));
    } finally {
      setItemLoading(false);
    }
  }, []);

  useEffect(() => {
    const id=selectedId||items[0]?.id;if(id)void loadItem(id);
  }, [selectedId,items,loadItem]);

  /* ====================================================================== */
  /* LOAD TRANSACTION SOURCES                                               */
  /* ====================================================================== */

  const loadTransactions = useCallback(async (id: string) => {
    if (!id) { setTransactions([]); return; }
    setTransactionLoading(true); setTransactionError('');
    try { const { data } = await getAllPages<ItemTransaction>(`/items/${id}/transactions`); setTransactions(data); }
    catch (error) { setTransactions([]); setTransactionError(getApiError(error, 'Could not load item transactions.')); }
    finally { setTransactionLoading(false); }
  }, []);

  useEffect(() => {
    const id=selectedId||items[0]?.id;if(id)void loadTransactions(id);
  }, [loadTransactions,selectedId,items]);

  /* ====================================================================== */
  /* COMPUTED                                                               */
  /* ====================================================================== */

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return term
      ? items.filter((entry) => [entry.name, entry.sku, showDescription ? entry.description : undefined, itemPrefs.itemCategories ? entry.category : undefined].some((value) => value?.toLowerCase().includes(term)))
      : items;
  }, [items, search, showDescription, itemPrefs.itemCategories]);

  const salesQty = Math.abs(
    transactions
      .filter((transaction) => transaction.type === 'SALE' && !['CANCELLED', 'DRAFT'].includes(transaction.status))
      .reduce((sum, transaction) => sum + transaction.quantity, 0),
  );

  const purchaseQty = transactions
    .filter((transaction) => transaction.type === 'PURCHASE' && ['ISSUED', 'ACCEPTED'].includes(transaction.status))
    .reduce((sum, transaction) => sum + transaction.quantity, 0);

  const totalStockValue = sumMoney(items.map((entry) => multiplyMoney(entry.stockQty, entry.purchasePrice ?? 0)));
  const lowStockCount = items.filter((entry) => isLowStock(Number(entry.stockQty))).length;

  /* ====================================================================== */
  /* ACTIONS                                                                */
  /* ====================================================================== */

  function openAddItem() {
    setEditingItem(null);
    setShowForm(true);
  }

  function openEditItem(target: Item) {
    setEditingItem(target);
    setShowForm(true);
  }

  function requestDeleteItem(target: Item) {
    if (deletingItemId || !canDeleteItem) return;
    setConfirmDeleteItem(target);
  }

  async function performDeleteItem() {
    const target = confirmDeleteItem;
    if (!target || deletingItemId) return;

    setDeletingItemId(target.id);
    setDeleteItemError('');

    try {
      await api.delete(`/items/${target.id}`);
      setItems((current) => current.filter((entry) => entry.id !== target.id));
      toast.danger('Item deleted', { description: target.name });
      setConfirmDeleteItem(null);

      if (itemId === target.id) router.push('/items');
    } catch (deleteError: unknown) {
      const message = getApiError(deleteError, 'Could not delete item.'); setDeleteItemError(message); toast.error(message);
      setConfirmDeleteItem(null);
    } finally {
      setDeletingItemId('');
    }
  }

  /* ====================================================================== */
  /* TRANSACTION ACTIONS                                                    */
  /* ====================================================================== */

  async function printTransaction(transaction: ItemTransaction) {
    const tab = window.open('about:blank', '_blank');
    if (!tab) return toast.error('Allow pop-ups to view this PDF.');
    tab.opener = null;
    try {
      const { data } = await api.get<Blob>(`${transactionResource(transaction)}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (pdfError) {
      tab.close();
      toast.error(getApiError(pdfError, 'Could not open PDF.'));
    }
  }

  async function runTransactionAction() {
    if (!confirmTransaction || transactionBusy) return;
    const { transaction, action } = confirmTransaction;
    const resource = transactionResource(transaction);
    setTransactionBusy(true);
    try {
      if (action === 'delete') await api.delete(resource);
      else if (transaction.type === 'SALE') await api.post(`${resource}/cancel`);
      else await api.patch(`${resource}/status`, { status: 'CANCELLED' });
      toast.success(`${transactionLabel(transaction)} ${action === 'cancel' ? 'cancelled' : 'deleted'}`, { description: transaction.number });
      setConfirmTransaction(null);
      // Cancelling or deleting moves stock, so refresh the item as well as its transactions.
      const id = selectedId || items[0]?.id;
      if (id) { void loadItem(id); void loadTransactions(id); }
    } catch (actionError) {
      toast.error(getApiError(actionError, action === 'cancel' ? 'Could not cancel.' : 'Could not delete.'));
    } finally {
      setTransactionBusy(false);
    }
  }

  /** Mirrors the server's rules, so each action only shows where it can succeed. */
  function transactionActions(transaction: ItemTransaction): Array<RowAction | false | undefined> {
    const sale = transaction.type === 'SALE';
    const recordId = encodeURIComponent(transaction.href.split('/').pop() ?? '');
    const editBase = sale ? '/invoices/new' : '/purchases/bills/new';
    const paid = ['PAID', 'PARTIALLY_PAID'].includes(transaction.status);
    const canEdit = sale ? transaction.status !== 'CANCELLED' && !paid : ['DRAFT', 'ISSUED', 'ACCEPTED'].includes(transaction.status);
    const canCancel = sale ? !['DRAFT', 'CANCELLED'].includes(transaction.status) && !paid : ['ISSUED', 'ACCEPTED'].includes(transaction.status);
    const canDelete = canDeleteItem && (sale ? !paid : ['DRAFT', 'CANCELLED'].includes(transaction.status));
    const message = `${transactionLabel(transaction)} ${transaction.number} dated ${formatDate(transaction.date)}\n${item?.name ?? 'Item'}: ${formatQuantity(Math.abs(transaction.quantity))} ${item?.unit ?? ''} × ${formatCurrency(transaction.rate)} = ${formatCurrency(transaction.total)}`;
    return [
      { label: 'View', icon: 'view', href: transaction.href },
      canEdit && { label: 'Edit', icon: 'edit', href: `${editBase}?editId=${recordId}` },
      { label: 'Duplicate', icon: 'duplicate', href: `${editBase}?duplicateId=${recordId}` },
      { label: 'Print / PDF', icon: 'print', onClick: () => void printTransaction(transaction) },
      { label: 'Share on WhatsApp', icon: 'whatsapp', href: whatsappLink(undefined, message), external: true },
      !sale && ['ISSUED', 'ACCEPTED'].includes(transaction.status) && { label: 'Make payment', icon: 'payment', href: `/purchases/payment-out?billId=${recordId}` },
      canCancel && { label: sale ? 'Cancel invoice' : 'Cancel bill', icon: 'cancel', danger: true, onClick: () => setConfirmTransaction({ transaction, action: 'cancel' }) },
      canDelete && { label: 'Delete', icon: 'delete', danger: true, onClick: () => setConfirmTransaction({ transaction, action: 'delete' }) },
    ];
  }

  function exportTransactions() {
    if (!item || transactions.length === 0) return;

    const rows = [
      ['Type', 'Number', 'Date', 'Quantity', 'Rate', 'Total', 'Status'],
      ...transactions.map((row) => [row.type, row.number, new Date(row.date).toLocaleDateString('en-IN'), row.quantity, row.rate, row.total, row.status]),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-transactions.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /* ====================================================================== */
  /* UI                                                                     */
  /* ====================================================================== */

  return (
    <>
      <ReferenceMaster title="Items" rows={filteredItems.map(i=>({id:i.id,name:i.name,value:formatQuantity(Number(i.stockQty))}))} selectedId={selectedId||items[0]?.id||''} query={search} onQuery={setSearch} onSelect={id=>{setSelectedId(id);if(id===selectedId)void loadItem(id);}} onAdd={openAddItem} onEdit={()=>item&&openEditItem(item)} onDelete={canDeleteItem&&item?()=>requestDeleteItem(item):undefined} loading={loading} error={error} onRetry={()=>void loadItems()} detailLoading={itemLoading||transactionLoading} detailError={itemError||transactionError} name={item?.name} facts={[{label:'SALE PRICE',value:formatCurrency(Number(item?.salePrice??0))},{label:'PURCHASE PRICE',value:formatCurrency(Number(item?.purchasePrice??0))},{label:'STOCK QUANTITY',value:formatQuantity(Number(item?.stockQty??0))+' '+(item?.unit??'')},{label:'STOCK VALUE',value:formatCurrency(multiplyMoney(item?.stockQty??0,item?.purchasePrice??0))}]} headers={['TYPE','INVOICE / REF. NO','DATE','QUANTITY','PRICE / UNIT','STATUS','ACTIONS']} transactions={transactions.map(t=>({id:t.id,cells:[t.type,<Link key="ref" href={t.href}>{t.number}</Link>,formatDate(t.date),formatQuantity(t.quantity)+' '+(item?.unit??''),formatCurrency(t.rate),t.status,<div key="actions" className="reference-row-actions flex justify-end"><RowActions label={`Actions for ${transactionLabel(t)} ${t.number}`} actions={transactionActions(t)}/></div>]}))} onExport={exportTransactions} actions={<Link href="/inventory/adjustments" className="btn-primary">ADJUST ITEM</Link>}/>
      <div className="reference-legacy-master min-h-screen bg-slate-50/70 p-4 sm:p-6">
        {itemId ? (
          /* ================================================================ */
          /* DETAIL VIEW                                                      */
          /* ================================================================ */

          itemLoading && !item ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <LoadingState label="Loading item..." />
            </section>
          ) : itemError ? (
            <section className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
              <ErrorState message={itemError} onRetry={() => loadItem(itemId)} />
            </section>
          ) : !item ? (
            <section className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
              <ErrorState message="Item not found." onRetry={() => loadItem(itemId)} />
            </section>
          ) : (
            <>
              <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-4 py-4 sm:px-5">
                  <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-blue-100/70 blur-3xl" />

                  <Link href="/items" className="relative mb-3 inline-flex items-center gap-1.5 text-[9px] font-bold text-blue-600 hover:text-blue-700">
                    <ArrowLeft size={12} />
                    Back to Items
                  </Link>

                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${
                            isLowStock(Number(item.stockQty)) ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isLowStock(Number(item.stockQty)) ? 'Low Stock' : 'In Stock'}
                        </span>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <h1 className="truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{item.name}</h1>

                        <button
                          type="button"
                          onClick={() => openEditItem(item)}
                          aria-label="Edit item"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={12} />
                        </button>

                        {canDeleteItem && (
                          <button
                            type="button"
                            disabled={deletingItemId === item.id}
                            onClick={() => requestDeleteItem(item)}
                            aria-label="Delete item"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {itemPrefs.itemCategories && item.category && <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-blue-600">{item.category}</p>}
                      {showDescription && <p className="mt-1 max-w-2xl truncate text-[9px] text-slate-500">{item.description || 'No description added'}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveForm('sale')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-3 text-[9px] font-extrabold text-blue-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                      >
                        <ShoppingCart size={12} />
                        Add Sale
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveForm('expense')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-extrabold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100"
                      >
                        <ArrowDownLeft size={12} />
                        Add Purchase
                      </button>

                      <div className="shrink-0 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-right shadow-sm">
                        <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">Current Stock Value</p>
                        <p className="mt-1 text-lg font-black text-blue-700">{formatCurrency(multiplyMoney(item.stockQty, item.purchasePrice ?? 0))}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {deleteItemError && (
                  <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[9px] font-semibold text-red-700 sm:px-5">
                    {deleteItemError}
                  </div>
                )}

                <div className="grid lg:grid-cols-[1.4fr_.6fr]">
                  <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                    <div className="mb-3">
                      <h3 className="text-[11px] font-black text-slate-900">Item Information</h3>
                      <p className="mt-0.5 text-[8px] text-slate-400">Product, pricing and tax information</p>
                    </div>

                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
                      <ItemFact label="SKU" value={item.sku || 'Not provided'} />
                      <ItemFact label="Sale Price" value={formatCurrency(item.salePrice)} highlight />
                      <ItemFact label="Tax Rate" value={`${Number(item.taxRate).toFixed(2)}%`} />
                      <ItemFact label="Unit" value={item.unit} />
                    </div>
                  </div>

                  <div className="bg-slate-50/60 p-4">
                    <div className="mb-3">
                      <h3 className="text-[11px] font-black text-slate-900">Stock Position</h3>
                      <p className="mt-0.5 text-[8px] text-slate-400">Current inventory movement</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                      <StockRow label="Current Stock" value={`${formatQuantity(item.stockQty)} ${item.unit}`} type="normal" />
                      <StockRow label="Purchased" value={`+${formatQuantity(purchaseQty)} ${item.unit}`} type="positive" />
                      <StockRow label="Sold" value={`-${formatQuantity(salesQty)} ${item.unit}`} type="negative" />
                    </div>
                  </div>
                </div>
              </section>

              {/* ============================================================ */}
              {/* TRANSACTIONS                                                */}
              {/* ============================================================ */}

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-4 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full bg-blue-600" />
                      <h3 className="text-[11px] font-black text-slate-950">Item Transactions</h3>
                    </div>
                    <p className="ml-3 mt-0.5 text-[8px] text-slate-400">Sales and purchase stock movement</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[8px] font-bold text-slate-500 sm:block">
                      {transactions.length} Transactions
                    </span>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      aria-label="Print transactions"
                    >
                      <Printer size={12} />
                    </button>

                    <button
                      type="button"
                      disabled={!transactions.length}
                      onClick={exportTransactions}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 transition-all hover:bg-blue-600 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                      aria-label="Export transactions"
                    >
                      <FileSpreadsheet size={12} />
                    </button>
                  </div>
                </div>

                {transactionLoading ? (
                  <LoadingState label="Loading item transactions..." />
                ) : transactionError ? (
                  <ErrorState message={transactionError} onRetry={() => loadTransactions(item.id)} />
                ) : transactions.length ? (
                  <div className="w-full">
                    <table className="w-full table-fixed border-collapse">
                      <caption className="sr-only">Item transactions</caption>
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/80">
                          <th className="w-[16%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">Type</th>
                          <th className="w-[24%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">Number</th>
                          <th className="hidden w-[15%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 md:table-cell">Date</th>
                          <th className="w-[19%] border-r border-slate-200 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">Qty</th>
                          <th className="hidden w-[13%] border-r border-slate-200 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 lg:table-cell">Rate</th>
                          <th className="w-[21%] px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-blue-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((transaction) => (
                          <TransactionRow key={transaction.id} transaction={transaction} unit={item.unit} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center px-5 py-10 text-center">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-600">No transactions yet</p>
                      <p className="mt-1 text-[8px] text-slate-400">Sales and issued purchases containing this item will appear here.</p>
                    </div>
                  </div>
                )}
              </section>
            </>
          )
        ) : (
          /* ================================================================ */
          /* LIST VIEW                                                        */
          /* ================================================================ */

          <>
            <section className="relative mb-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />

              <div className="relative flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-blue-600" />
                    <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">Inventory Management</span>
                  </div>

                  <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Items</h1>
                  <p className="mt-1 text-[10px] text-slate-500">Manage inventory, pricing, stock movement and item transactions.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm('sale')}
                    className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-3 text-[9px] font-extrabold text-blue-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <ShoppingCart size={12} />
                    Add Sale
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveForm('expense')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[9px] font-extrabold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-100"
                  >
                    <ArrowDownLeft size={12} />
                    Add Purchase
                  </button>

                  <button
                    type="button"
                    onClick={openAddItem}
                    className="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[9px] font-extrabold text-white shadow-[0_7px_18px_rgba(37,99,235,0.20)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)]"
                  >
                    <Plus size={12} className="transition-transform group-hover:rotate-90" />
                    Add Item
                  </button>
                </div>
              </div>

              <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
            </section>

            {/* ================================================================ */}
            {/* KPI SUMMARY                                                      */}
            {/* ================================================================ */}

            <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <InventoryMetric icon={Package} label="Total Items" value={items.length.toLocaleString('en-IN')} helper="Inventory records" tone="blue" />
              <InventoryMetric
                icon={Boxes}
                label="Stock Units"
                value={formatQuantity(items.reduce((total, entry) => total + Number(entry.stockQty), 0))}
                helper="Current quantity"
                tone="violet"
              />
              <InventoryMetric icon={TrendingDown} label="Low Stock" value={lowStockCount.toLocaleString('en-IN')} helper={itemPrefs.lowStockAlert ? `${itemPrefs.lowStockThreshold} units or less` : 'Alerts are turned off'} tone="amber" />
              <InventoryMetric icon={WalletCards} label="Stock Value" value={formatCurrency(totalStockValue)} helper="Based on sale price" tone="emerald" />
            </section>

            {deleteItemError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[9px] font-semibold text-red-700">
                {deleteItemError}
              </div>
            )}

            {/* ================================================================ */}
            {/* ITEM REGISTER                                                    */}
            {/* ================================================================ */}

            <ItemRegisterTable
              items={filteredItems}
              search={search}
              onSearch={setSearch}
              onOpen={(id) => router.push(`/items/${id}`)}
              onEdit={openEditItem}
              onDelete={requestDeleteItem}
              canDelete={canDeleteItem}
              deletingId={deletingItemId}
              loading={loading}
              error={error}
              onRetry={() => loadItems()}
            />
          </>
        )}
      </div>

      {/* ================================================================== */}
      {/* MODALS                                                             */}
      {/* ================================================================== */}

      {activeForm === 'sale' && <InvoiceModal onClose={() => setActiveForm(null)} />}
      {activeForm === 'expense' && <DocumentModal type="PURCHASE_INVOICE" onClose={() => setActiveForm(null)} />}

      {showForm && (
        <ItemFormModal
          item={editingItem}
          onClose={() => setShowForm(false)}
          onSaved={(_saved, keepOpen) => {
            setShowForm(Boolean(keepOpen));

            if (selectedId || itemId) {
              void loadItem(selectedId || itemId!);
            } else {
              void loadItems();
            }
          }}
        />
      )}

      {confirmDeleteItem && (
        <ConfirmDialog
          title="Delete item?"
          message={`Delete ${confirmDeleteItem.name} from the item register? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deletingItemId === confirmDeleteItem.id}
          onCancel={() => setConfirmDeleteItem(null)}
          onConfirm={() => void performDeleteItem()}
        />
      )}

      {confirmTransaction && (
        <ConfirmDialog
          title={`${confirmTransaction.action === 'cancel' ? 'Cancel' : 'Delete'} ${confirmTransaction.transaction.number}?`}
          message={confirmTransaction.action === 'cancel'
            ? `This ${transactionLabel(confirmTransaction.transaction).toLowerCase()} will be cancelled and its stock and balances reversed. It stays in the register.`
            : `This ${transactionLabel(confirmTransaction.transaction).toLowerCase()} will be removed. Linked payments and stock are protected by the billing rules, so the server may refuse if it is still in use.`}
          confirmLabel={confirmTransaction.action === 'cancel' ? 'Cancel it' : 'Delete'}
          busyLabel={confirmTransaction.action === 'cancel' ? 'Cancelling...' : 'Deleting...'}
          busy={transactionBusy}
          onCancel={() => setConfirmTransaction(null)}
          onConfirm={() => void runTransactionAction()}
        />
      )}
    </>
  );
}

/* ========================================================================== */
/* ITEM REGISTER                                                              */
/* ========================================================================== */

function ItemRegisterTable({
  items,
  search,
  onSearch,
  onOpen,
  onEdit,
  onDelete,
  canDelete,
  deletingId,
  loading,
  error,
  onRetry,
}: {
  items: Item[];
  search: string;
  onSearch: (value: string) => void;
  onOpen: (id: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  canDelete: boolean;
  deletingId: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const { itemDescription: showDescription } = useGeneralPreferences();
  const itemPrefs = usePreferences('item');
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="grid items-end gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 px-3 py-3 sm:grid-cols-[180px_minmax(220px,1fr)] sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-blue-600" />
            <h2 className="text-[11px] font-black text-slate-950">Item Register</h2>
          </div>
          <p className="ml-3 mt-0.5 text-[8px] text-slate-400">{items.length} records shown</p>
        </div>

        <div className="relative min-w-0">
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 text-[9px] font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder={showDescription ? 'Search item name, SKU or description...' : 'Search item name or SKU...'}
            aria-label="Search items"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading items..." />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="No items found" description={search ? 'Try a different search.' : 'Add your first item to start billing.'} />
      ) : (
        <div className="w-full">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">Item register</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-950">
                <th className="w-[24%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">Item</th>
                <th className="hidden w-[13%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 md:table-cell">SKU</th>
                <th className="hidden w-[8%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 lg:table-cell">Unit</th>
                <th className="w-[15%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">Price</th>
                <th className="hidden w-[8%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 xl:table-cell">Tax</th>
                <th className="w-[15%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">Stock</th>
                <th className="w-[17%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-blue-300">Value</th>
                <th className="w-[10%] px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">Actions</th>
              </tr>
            </thead>

            <tbody>
              {items.map((entry, index) => {
                const stock = Number(entry.stockQty);
                const lowStock = itemPrefs.lowStockAlert && stock <= itemPrefs.lowStockThreshold;

                return (
                  <tr
                    key={entry.id}
                    onClick={() => onOpen(entry.id)}
                    className={`group cursor-pointer border-b border-slate-100 transition-all duration-200 ${
                      index % 2 ? 'bg-slate-50/40 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'
                    }`}
                  >
                    <td className="min-w-0 border-r border-slate-100 px-3 py-3">
                      <p className="truncate text-[10px] font-extrabold text-slate-900 transition-colors group-hover:text-blue-700">{entry.name}</p>
                      {itemPrefs.itemCategories && entry.category && <p className="mt-0.5 truncate text-[7px] font-bold uppercase tracking-wide text-blue-500">{entry.category}</p>}
                      {showDescription && entry.description && <p className="mt-0.5 hidden truncate text-[7px] text-slate-400 sm:block">{entry.description}</p>}
                    </td>

                    <td className="hidden border-r border-slate-100 px-3 py-3 font-mono text-[9px] text-slate-500 md:table-cell">{entry.sku || '—'}</td>

                    <td className="hidden border-r border-slate-100 px-3 py-3 text-[9px] font-semibold text-slate-500 lg:table-cell">{entry.unit}</td>

                    <td className="border-r border-slate-100 px-3 py-3 text-right text-[9px] font-extrabold text-slate-800">{formatCurrency(entry.salePrice)}</td>

                    <td className="hidden border-r border-slate-100 px-3 py-3 text-right text-[8px] font-semibold text-slate-500 xl:table-cell">
                      {Number(entry.taxRate).toFixed(2)}%
                    </td>

                    <td className="border-r border-slate-100 px-3 py-3 text-right">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[8px] font-extrabold ${
                          lowStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {formatQuantity(stock)} {entry.unit}
                      </span>
                    </td>

                    <td className="border-r border-slate-100 bg-blue-50/20 px-3 py-3 text-right">
                      <span className="whitespace-nowrap text-[9px] font-black text-slate-900">{formatCurrency(multiplyMoney(stock, entry.purchasePrice ?? 0))}</span>
                    </td>

                    <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(entry)}
                          aria-label={`Edit ${entry.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil size={12} />
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            disabled={deletingId === entry.id}
                            onClick={() => onDelete(entry)}
                            aria-label={`Delete ${entry.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ========================================================================== */
/* TRANSACTION ROW                                                            */
/* ========================================================================== */

function TransactionRow({ transaction, unit }: { transaction: ItemTransaction; unit: string }) {
  const purchase = transaction.type === 'PURCHASE';

  return (
    <tr className="group border-b border-slate-100 transition-all duration-200 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]">
      <td className="border-r border-slate-100 px-3 py-3">
        <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[8px] font-extrabold ${purchase ? 'text-emerald-700' : 'text-blue-700'}`}>
          {purchase ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
          {purchase ? 'Purchase' : 'Sale'}
        </span>
      </td>

      <td className="min-w-0 border-r border-slate-100 px-3 py-3">
        <Link href={transaction.href} className="block truncate text-[9px] font-extrabold text-blue-600 hover:text-blue-800">
          {transaction.number}
        </Link>
        <div className="mt-1">
          <StatusBadge status={transaction.status} />
        </div>
      </td>

      <td className="hidden whitespace-nowrap border-r border-slate-100 px-3 py-3 text-[8px] font-medium text-slate-500 md:table-cell">{formatDate(transaction.date)}</td>

      <td className={`border-r border-slate-100 px-3 py-3 text-right text-[9px] font-black ${purchase ? 'text-emerald-600' : 'text-red-600'}`}>
        {purchase ? '+' : '-'}
        {formatQuantity(Math.abs(transaction.quantity))} {unit}
      </td>

      <td className="hidden whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right text-[8px] font-semibold text-slate-600 lg:table-cell">{formatCurrency(transaction.rate)}</td>

      <td className="bg-blue-50/20 px-3 py-3 text-right text-[9px] font-black text-slate-900">{formatCurrency(transaction.total)}</td>
    </tr>
  );
}

/* ========================================================================== */
/* METRIC CARD                                                                */
/* ========================================================================== */

const INVENTORY_TONES = {
  blue: { icon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white', accent: 'bg-blue-600', border: 'hover:border-blue-200' },
  violet: { icon: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white', accent: 'bg-violet-500', border: 'hover:border-violet-200' },
  amber: { icon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white', accent: 'bg-amber-500', border: 'hover:border-amber-200' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white', accent: 'bg-emerald-500', border: 'hover:border-emerald-200' },
} as const;

function InventoryMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  helper: string;
  tone: keyof typeof INVENTORY_TONES;
}) {
  const style = INVENTORY_TONES[tone];

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] ${style.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">{value}</p>
          <p className="mt-1 truncate text-[8px] text-slate-400">{helper}</p>
        </div>

        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${style.icon}`}>
          <Icon size={17} />
        </span>
      </div>

      <span className={`absolute bottom-0 left-0 h-[3px] w-0 transition-all duration-300 group-hover:w-full ${style.accent}`} />
    </div>
  );
}

/* ========================================================================== */
/* ITEM FACT                                                                  */
/* ========================================================================== */

function ItemFact({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0 bg-white px-3 py-3 transition-colors hover:bg-slate-50">
      <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p title={value} className={`mt-1 truncate text-[10px] font-extrabold ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  );
}

/* ========================================================================== */
/* STOCK ROW                                                                  */
/* ========================================================================== */

function StockRow({ label, value, type }: { label: string; value: string; type: 'normal' | 'positive' | 'negative' }) {
  const styles = {
    normal: 'border-slate-200 bg-white text-slate-800',
    positive: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
    negative: 'border-red-100 bg-red-50/70 text-red-600',
  };

  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-sm ${styles[type]}`}>
      <span className="truncate text-[8px] font-bold opacity-70">{label}</span>
      <strong className="whitespace-nowrap text-[9px] font-black">{value}</strong>
    </div>
  );
}

/* ========================================================================== */
/* ITEM FORM                                                                  */
/* ========================================================================== */

function ItemFormModal({item,onClose,onSaved}:{item:Item|null;onClose:()=>void;onSaved:(item:Item,keepOpen?:boolean)=>void}){return <ReferenceItemForm item={item} onClose={onClose} onSaved={onSaved}/>}
/* ========================================================================== */
/* FORM FIELD                                                                 */
/* ========================================================================== */

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[7px] font-black uppercase tracking-[0.11em] text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
