'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList, CircleDollarSign, ReceiptIndianRupee, ReceiptText, RotateCcw, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { BusinessDocument, ProductionOrder } from '@/types';

const SECTIONS: Array<{ href: string; label: string; description: string; icon: LucideIcon; tone: string }> = [
  { href: '/purchases/bills', label: 'Purchase Bills', description: 'Supplier bills, GST input, and incoming stock.', icon: ReceiptText, tone: 'bg-blue-50 text-blue-700' },
  { href: '/purchases/payment-out', label: 'Payment-Out', description: 'Payments already made to suppliers and partners.', icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700' },
  { href: '/purchases/expenses', label: 'Expenses', description: 'Material, labour, transport, and other costs.', icon: ReceiptIndianRupee, tone: 'bg-violet-50 text-violet-700' },
  { href: '/purchases/orders', label: 'Purchase Order', description: 'Supplier-linked orders for active projects.', icon: ClipboardList, tone: 'bg-cyan-50 text-cyan-700' },
  { href: '/purchases/returns', label: 'Purchase Return / Dr. Note', description: 'Returns, corrections, and debit-note adjustments.', icon: RotateCcw, tone: 'bg-amber-50 text-amber-700' },
];

export default function PurchasesPage() {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [documentResponse, orderResponse] = await Promise.all([
        getAllPages<BusinessDocument>('/documents'),
        getAllPages<ProductionOrder>('/production-orders'),
      ]);
      setDocuments(documentResponse.data);
      setOrders(orderResponse.data);
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load purchase workspace.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  const summary = useMemo(() => {
    const bills = documents.filter((document) => document.type === 'PURCHASE_INVOICE');
    const costs = orders.flatMap((order) => order.costs);
    return {
      purchaseValue: bills.reduce((sum, document) => sum + Number(document.grandTotal), 0),
      expenseValue: costs.reduce((sum, cost) => sum + Number(cost.amount), 0),
      paidValue: costs.reduce((sum, cost) => sum + Number(cost.paidAmount), 0),
      supplierOrders: orders.filter((order) => Boolean(order.supplier) && !['COMPLETED', 'CANCELLED'].includes(order.status)).length,
    };
  }, [documents, orders]);

  return <><PageHeader title="Purchase & Expense" description="Manage supplier purchases, outgoing payments, project expenses, purchase orders, and returns." />{loading ? <section className="card"><LoadingState label="Preparing purchase workspace..." /></section> : error ? <section className="card"><ErrorState message={error} onRetry={loadData} /></section> : <><div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Purchase value" value={formatCurrency(summary.purchaseValue)} /><Metric label="Expense value" value={formatCurrency(summary.expenseValue)} /><Metric label="Payments made" value={formatCurrency(summary.paidValue)} /><Metric label="Open supplier orders" value={summary.supplierOrders.toLocaleString('en-IN')} /></div><section><div className="mb-3 flex items-center gap-2"><ShoppingCart aria-hidden="true" size={17} className="text-blue-600" /><div><h2 className="text-sm font-bold text-slate-900">Purchase workspace</h2><p className="text-[10px] text-slate-400">Choose a register to continue</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{SECTIONS.map(({ href, label, description, icon: Icon, tone }) => <Link key={href} href={href} className="card group flex min-h-28 items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon aria-hidden="true" size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span><ArrowRight aria-hidden="true" size={17} className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" /></Link>)}</div></section></>}</>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card min-w-0 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-lg font-extrabold text-slate-950 sm:text-xl">{value}</p></div>;
}
