'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Boxes, FileSpreadsheet, FileText, MoreVertical, Package, Pencil, Plus, Printer, Search } from 'lucide-react';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { BusinessDocument, Invoice, Item } from '@/types';

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

type TransactionSources = { invoices: Invoice[]; documents: BusinessDocument[] };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<ItemTransaction[]>([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const sourcesRef = useRef<TransactionSources | null>(null);

  const loadItems = useCallback(async (preferredId?: string) => {
    setLoading(true); setError('');
    try {
      const { data } = await getAllPages<Item>('/items');
      setItems(data);
      setSelectedItemId((current) => preferredId && data.some((item) => item.id === preferredId) ? preferredId : current && data.some((item) => item.id === current) ? current : data[0]?.id ?? '');
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load items.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const loadTransactionSources = useCallback(async () => {
    if (sourcesRef.current) return sourcesRef.current;
    const [invoiceList, documentList] = await Promise.all([
      getAllPages<Invoice>('/invoices'),
      getAllPages<BusinessDocument>('/documents'),
    ]);
    const purchaseDocuments = documentList.data.filter((document) => document.type === 'PURCHASE_INVOICE');
    const [invoiceResults, documentResults] = await Promise.all([
      Promise.allSettled(invoiceList.data.map((invoice) => api.get<Invoice>(`/invoices/${invoice.id}`))),
      Promise.allSettled(purchaseDocuments.map((document) => api.get<BusinessDocument>(`/documents/${document.id}`))),
    ]);
    const sources = {
      invoices: invoiceResults.flatMap((result) => result.status === 'fulfilled' ? [result.value.data] : []),
      documents: documentResults.flatMap((result) => result.status === 'fulfilled' ? [result.value.data] : []),
    };
    sourcesRef.current = sources;
    return sources;
  }, []);

  const loadTransactions = useCallback(async (itemId: string) => {
    if (!itemId) { setTransactions([]); return; }
    setTransactionLoading(true); setTransactionError('');
    try {
      const sources = await loadTransactionSources();
      const sales = sources.invoices.flatMap((invoice) => invoice.items.filter((line) => line.itemId === itemId).map((line) => ({ id: `sale-${line.id}`, type: 'SALE' as const, number: invoice.invoiceNumber, date: invoice.issueDate, quantity: -Number(line.quantity), rate: Number(line.unitPrice), total: Number(line.lineTotal), status: invoice.status, href: `/invoices/${invoice.id}` })));
      const purchases = sources.documents.flatMap((document) => (document.items ?? []).filter((line) => line.itemId === itemId).map((line) => ({ id: `purchase-${line.id}`, type: 'PURCHASE' as const, number: document.documentNumber, date: document.issueDate, quantity: Number(line.quantity), rate: Number(line.unitPrice), total: Number(line.lineTotal), status: document.status, href: `/documents/${document.id}` })));
      setTransactions([...sales, ...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (loadError: unknown) { setTransactions([]); setTransactionError(getApiError(loadError, 'Could not load item transactions.')); }
    finally { setTransactionLoading(false); }
  }, [loadTransactionSources]);

  useEffect(() => { void loadTransactions(selectedItemId); }, [loadTransactions, selectedItemId]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => [item.name, item.sku, item.description].some((value) => value?.toLowerCase().includes(term))) : items;
  }, [items, search]);
  const salesQty = Math.abs(transactions.filter((transaction) => transaction.type === 'SALE' && transaction.status !== 'CANCELLED').reduce((sum, transaction) => sum + transaction.quantity, 0));
  const purchaseQty = transactions.filter((transaction) => transaction.type === 'PURCHASE' && ['ISSUED', 'ACCEPTED'].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.quantity, 0);

  function openAddItem() { setEditingItem(null); setShowForm(true); }
  function openEditItem() { if (selectedItem) { setEditingItem(selectedItem); setShowForm(true); } }

  function exportTransactions() {
    if (!selectedItem || transactions.length === 0) return;
    const rows = [['Type', 'Number', 'Date', 'Quantity', 'Rate', 'Total', 'Status'], ...transactions.map((row) => [row.type, row.number, new Date(row.date).toLocaleDateString('en-IN'), row.quantity, row.rate, row.total, row.status])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${selectedItem.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-transactions.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-slate-100 lg:min-h-dvh">
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:px-5">
          <div><h1 className="text-xl font-extrabold tracking-tight text-slate-950">Items</h1><p className="text-[11px] text-slate-400">Inventory details and stock transactions</p></div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link href="/invoices/new" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"><Plus size={15} />Add Sale</Link>
            <Link href="/documents/new?type=PURCHASE_INVOICE" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"><Plus size={15} />Add Purchase</Link>
            <button type="button" onClick={openAddItem} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"><Plus size={16} />Add Item</button>
            <button type="button" className="flex h-8 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="More options"><MoreVertical size={18} /></button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-1 p-1 lg:grid-cols-[315px_minmax(0,1fr)]">
          <aside className="flex min-h-[360px] flex-col overflow-hidden rounded-md bg-white">
            <div className="p-3"><div className="relative"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-full border border-slate-300 bg-white pl-10 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Search Item Name" aria-label="Search items" /></div></div>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] border-y border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600"><span className="px-3 py-2.5">Item Name</span><span className="border-l border-slate-200 px-3 py-2.5 text-right">Quantity</span></div>
            <div className="max-h-[330px] flex-1 overflow-y-auto lg:max-h-none">
              {loading ? <LoadingState label="Loading items..." /> : error ? <ErrorState message={error} onRetry={() => loadItems()} /> : items.length === 0 ? <EmptyState icon={Package} title="No items yet" description="Add products or services to start billing." /> : filteredItems.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">No item matches your search.</div> : filteredItems.map((item) => { const active = item.id === selectedItemId; const lowStock = Number(item.stockQty) <= 5; return <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_110px] border-l-[3px] text-left transition ${active ? 'border-blue-600 bg-blue-50' : 'border-b border-l-transparent border-b-slate-100 hover:bg-slate-50'}`}><span className="truncate px-3 py-3 text-xs font-bold text-slate-900">{item.name}</span><span className={`border-l border-slate-200/70 px-2.5 py-3 text-right text-xs font-semibold ${lowStock ? 'text-amber-700' : 'text-slate-600'}`}>{Number(item.stockQty).toLocaleString('en-IN')} {item.unit}</span></button>; })}
            </div>
            <div className="m-2 mt-auto flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] font-bold text-slate-700">{filteredItems.length} items</p><p className="text-[10px] text-slate-400">Name, SKU or description</p></div>
          </aside>

          <main className="flex min-w-0 flex-col gap-1">
            {!selectedItem ? <div className="flex-1 rounded-md bg-white"><EmptyState icon={Boxes} title="Select an item" description="Choose an item from the left to view details and stock transactions." /></div> : <>
              <section className="rounded-md bg-white p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-1.5"><h2 className="truncate text-base font-extrabold text-slate-950">{selectedItem.name}</h2><button type="button" onClick={openEditItem} className="text-blue-600 hover:text-blue-800" aria-label="Edit item"><Pencil size={15} /></button></div><p className="mt-1 text-[11px] text-slate-400">{selectedItem.description || 'No description added'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${Number(selectedItem.stockQty) <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{Number(selectedItem.stockQty) <= 5 ? 'Low stock' : 'In stock'}</span></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ItemField label="SKU" value={selectedItem.sku || 'Not provided'} /><ItemField label="Sale price" value={formatCurrency(selectedItem.salePrice)} /><ItemField label="Tax rate" value={`${Number(selectedItem.taxRate).toFixed(2)}%`} /><ItemField label="Unit" value={selectedItem.unit} /></div>
                <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-4"><MiniTotal label="Current stock" value={`${Number(selectedItem.stockQty).toLocaleString('en-IN')} ${selectedItem.unit}`} /><MiniTotal label="Purchased" value={`${purchaseQty.toLocaleString('en-IN')} ${selectedItem.unit}`} /><MiniTotal label="Sold" value={`${salesQty.toLocaleString('en-IN')} ${selectedItem.unit}`} /><MiniTotal label="Stock value" value={formatCurrency(Number(selectedItem.stockQty) * Number(selectedItem.salePrice))} /></div>
              </section>

              <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-md bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3"><div><h3 className="text-sm font-bold text-slate-950">Item Transactions</h3><p className="text-[10px] text-slate-400">Sales and purchase stock movements</p></div><div className="flex items-center gap-0.5"><button type="button" onClick={() => window.print()} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Print transactions"><Printer size={16} /></button><button type="button" disabled={!transactions.length} onClick={exportTransactions} className="flex h-8 w-8 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 disabled:opacity-30" aria-label="Export transactions"><FileSpreadsheet size={16} /></button></div></div>
                {transactionLoading ? <LoadingState label="Loading item transactions..." /> : transactionError ? <ErrorState message={transactionError} onRetry={() => loadTransactions(selectedItem.id)} /> : transactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] table-fixed text-xs"><thead className="bg-slate-50 text-left text-[11px] font-bold text-slate-600"><tr><th className="w-[16%] border-r border-slate-200 px-3 py-2.5">Type</th><th className="w-[22%] border-r border-slate-200 px-3 py-2.5">Number</th><th className="w-[16%] border-r border-slate-200 px-3 py-2.5">Date</th><th className="w-[13%] border-r border-slate-200 px-3 py-2.5 text-right">Quantity</th><th className="w-[14%] border-r border-slate-200 px-3 py-2.5 text-right">Rate</th><th className="w-[19%] px-3 py-2.5 text-right">Total</th></tr></thead><tbody>{transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} unit={selectedItem.unit} />)}</tbody></table></div> : <div className="flex flex-1 items-center justify-center px-5 py-10 text-center"><div><FileText className="mx-auto text-slate-300" size={26} /><p className="mt-2 text-xs font-bold text-slate-600">No transactions yet</p><p className="mt-1 text-[11px] text-slate-400">Sales and issued purchases containing this item will appear here.</p></div></div>}
              </section>
            </>}
          </main>
        </section>
      </div>

      {showForm && <ItemFormModal item={editingItem} onClose={() => setShowForm(false)} onSaved={(savedItem) => { setShowForm(false); sourcesRef.current = null; void loadItems(savedItem.id); }} />}
    </>
  );
}

function ItemField({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-0.5 truncate text-xs font-semibold text-slate-800">{value}</p></div>; }
function MiniTotal({ label, value }: { label: string; value: string }) { return <div className="bg-slate-50 px-2.5 py-2"><p className="text-[9px] font-medium text-slate-400">{label}</p><p className="text-[11px] font-bold text-slate-800">{value}</p></div>; }

function TransactionRow({ transaction, unit }: { transaction: ItemTransaction; unit: string }) {
  const purchase = transaction.type === 'PURCHASE';
  return <tr className="border-b border-slate-100 hover:bg-blue-50/30"><td className="border-r border-slate-100 px-3 py-3"><span className={`inline-flex items-center gap-1.5 font-semibold ${purchase ? 'text-emerald-700' : 'text-blue-700'}`}>{purchase ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}{purchase ? 'Purchase' : 'Sale'}</span></td><td className="truncate border-r border-slate-100 px-3 py-3"><Link href={transaction.href} className="font-bold text-blue-600 hover:underline">{transaction.number}</Link><span className="ml-2"><StatusBadge status={transaction.status} /></span></td><td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-slate-600">{formatDate(transaction.date)}</td><td className={`whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold ${purchase ? 'text-emerald-600' : 'text-red-600'}`}>{purchase ? '+' : '-'}{Math.abs(transaction.quantity).toLocaleString('en-IN')} {unit}</td><td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right text-slate-700">{formatCurrency(transaction.rate)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-900">{formatCurrency(transaction.total)}</td></tr>;
}

function ItemFormModal({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: (item: Item) => void }) {
  const [form, setForm] = useState({ name: item?.name ?? '', sku: item?.sku ?? '', description: item?.description ?? '', unit: item?.unit ?? 'pcs', salePrice: String(item?.salePrice ?? ''), taxRate: String(item?.taxRate ?? 0), stockQty: String(item?.stockQty ?? 0) });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError('');
    try {
      const payload = { name: form.name.trim(), sku: form.sku.trim() || undefined, description: form.description.trim() || undefined, unit: form.unit.trim(), salePrice: Number(form.salePrice), taxRate: Number(form.taxRate), stockQty: Number(form.stockQty) };
      const { data } = item ? await api.patch<Item>(`/items/${item.id}`, payload) : await api.post<Item>('/items', payload);
      onSaved(data);
    } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not save item.')); }
    finally { setSaving(false); }
  }

  return <Modal title={item ? 'Edit item' : 'Add item'} onClose={onClose} size="lg" className="!max-w-2xl"><form onSubmit={handleSubmit} className="space-y-4">{error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}<div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="item-name" className="label">Item name *</label><input id="item-name" required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div><label htmlFor="item-sku" className="label">SKU</label><input id="item-sku" className="input-field" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></div></div><div><label htmlFor="item-description" className="label">Description</label><textarea id="item-description" rows={2} className="input-field resize-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><label htmlFor="item-unit" className="label">Unit *</label><input id="item-unit" required className="input-field" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></div><div><label htmlFor="item-price" className="label">Sale price *</label><input id="item-price" required type="number" step="0.01" min="0" className="input-field" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} /></div><div><label htmlFor="item-tax" className="label">Tax %</label><input id="item-tax" type="number" step="0.01" min="0" max="100" className="input-field" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></div><div><label htmlFor="item-stock" className="label">Stock</label><input id="item-stock" type="number" step="0.001" min="0" className="input-field" value={form.stockQty} onChange={(event) => setForm({ ...form, stockQty: event.target.value })} /></div></div><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary min-w-28">{saving ? 'Saving...' : item ? 'Update item' : 'Save item'}</button></div></form></Modal>;
}
